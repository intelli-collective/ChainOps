import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AccessTokenGuard } from '../src/pipelines/access-token.guard.js';
import { PipelineConfigController } from '../src/pipelines/pipeline-config.controller.js';
import { PipelineConfigService } from '../src/pipelines/pipeline-config.service.js';
import { GitHubService } from '../src/pipelines/github.service.js';

// Explicit opt-in only (same variable as the auth suite). Every table lives in a
// uniquely named test schema that is dropped afterwards; no shared data is touched.
describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)('pipeline configuration API (PostgreSQL integration)', () => {
  let pool: pg.Pool, admin: pg.Client, app: INestApplication;
  const schema = `pipeline_test_${randomUUID().replaceAll('-', '')}`;
  let memberToken: string, outsiderToken: string, projectId: string, otherProjectId: string, emptyProjectId: string;
  const body = { name: 'Smart Contract CI', repository: 'intelli-collective/vault-contracts', branch: 'main', framework: 'hardhat', stages: ['compile', 'test', 'security'] };
  const http = () => request(app.getHttpServer());
  const path = (id: string) => `/projects/${id}/pipeline`;

  beforeAll(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173'); vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4)); vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
    admin = new pg.Client({ connectionString: process.env.AUTH_TEST_DATABASE_URL }); await admin.connect();
    await admin.query(`create schema "${schema}"`);
    pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    for (const name of ['001_core_schema.sql', '002_authentication.sql', '003_password_resets.sql', '004_pipeline_configs.sql', '005_pipeline_execution.sql']) {
      await pool.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    const db = { query: (sql: string, args?: unknown[]) => pool.query(sql, args), transaction: async (work: (c: pg.PoolClient) => Promise<unknown>) => {
      const c = await pool.connect(); try { await c.query('begin'); const value = await work(c); await c.query('commit'); return value; } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    } } as DatabaseService;

    const user = async (email: string) => (await pool.query<{ id: string }>('insert into users(full_name,email,email_verified_at) values($1,$2,now()) returning id', [email, email])).rows[0].id;
    const member = await user('member@example.test'), outsider = await user('outsider@example.test');
    const org = async (slug: string, owner: string) => (await pool.query<{ id: string }>('insert into organizations(name,slug,created_by_id) values($1,$1,$2) returning id', [slug, owner])).rows[0].id;
    const memberOrg = await org('member-org', member), otherOrg = await org('other-org', outsider);
    await pool.query('insert into organization_members(organization_id,user_id) values($1,$2),($3,$4)', [memberOrg, member, otherOrg, outsider]);
    const project = async (orgId: string, slug: string, framework: string, owner: string) => (await pool.query<{ id: string }>('insert into projects(organization_id,name,slug,framework,created_by_id) values($1,$2,$2,$3,$4) returning id', [orgId, slug, framework, owner])).rows[0].id;
    projectId = await project(memberOrg, 'chainvault', 'hardhat', member);
    emptyProjectId = await project(memberOrg, 'token-factory', 'foundry', member);
    otherProjectId = await project(otherOrg, 'dao-governance', 'foundry', outsider);

    // GitHub is stubbed: these tests cover the API and database, not network access.
    const github = { resolveBranch: async () => 'a'.repeat(40) } as unknown as GitHubService;
    const auth = new AuthService(db);
    memberToken = (await auth.createSession(member)).access;
    outsiderToken = (await auth.createSession(outsider)).access;
    const module = await Test.createTestingModule({
      controllers: [PipelineConfigController],
      providers: [{ provide: AuthService, useValue: auth }, { provide: PipelineConfigService, useValue: new PipelineConfigService(db, github) }, AccessTokenGuard],
    }).compile();
    app = module.createNestApplication(); await app.init();
  }, 60000);

  afterAll(async () => {
    await app?.close(); await pool?.end();
    if (admin) { await admin.query(`drop schema if exists "${schema}" cascade`); await admin.end(); }
    vi.unstubAllEnvs();
  });

  it('rejects requests without a valid access token (401)', async () => {
    await http().get(path(projectId)).expect(401);
    await http().post(path(projectId)).set('Authorization', 'Bearer not-a-jwt').send(body).expect(401);
  });

  it('creates a configuration (201) and returns it on GET (200)', async () => {
    const created = await http().post(path(projectId)).set('Authorization', `Bearer ${memberToken}`).send(body).expect(201);
    expect(created.body).toMatchObject({ projectId, ...body });
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(created.body.createdAt).toISOString()).toBe(created.body.createdAt);
    const fetched = await http().get(path(projectId)).set('Authorization', `Bearer ${memberToken}`).expect(200);
    expect(fetched.body).toEqual(created.body);
    const row = (await pool.query('select * from pipeline_configs where project_id=$1', [projectId])).rows[0];
    expect(row).toMatchObject({ name: body.name, repository: body.repository, branch: 'main', framework: 'hardhat', stages: body.stages });
  });

  it('returns 409 for a second configuration on the same project', async () => {
    const res = await http().post(path(projectId)).set('Authorization', `Bearer ${memberToken}`).send({ ...body, name: 'Duplicate' }).expect(409);
    expect(res.body).toMatchObject({ statusCode: 409 });
    expect((await pool.query('select count(*)::int n from pipeline_configs where project_id=$1', [projectId])).rows[0].n).toBe(1);
  });

  it('updates only the provided fields (200) and GET reflects the change', async () => {
    const before = (await http().get(path(projectId)).set('Authorization', `Bearer ${memberToken}`)).body;
    const patched = await http().patch(path(projectId)).set('Authorization', `Bearer ${memberToken}`).send({ branch: 'develop', stages: ['checkout', 'compile', 'test', 'slither'] }).expect(200);
    expect(patched.body).toMatchObject({ ...before, branch: 'develop', stages: ['checkout', 'compile', 'test', 'slither'], updatedAt: expect.any(String) });
    expect(new Date(patched.body.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
    expect(patched.body.createdAt).toBe(before.createdAt);
    const fetched = await http().get(path(projectId)).set('Authorization', `Bearer ${memberToken}`).expect(200);
    expect(fetched.body).toEqual(patched.body);
  });

  it('rejects invalid input with 400 and leaves the stored row unchanged', async () => {
    const auth = { Authorization: `Bearer ${memberToken}` };
    const invalidStage = await http().post(path(emptyProjectId)).set(auth).send({ ...body, stages: ['compile', 'rm -rf'] }).expect(400);
    expect(invalidStage.body.message).toMatch(/Unsupported stage/);
    await http().patch(path(projectId)).set(auth).send({ stages: ['deploy-mainnet'] }).expect(400);
    await http().patch(path(projectId)).set(auth).send({ repository: 'not a repo' }).expect(400);
    await http().patch(path(projectId)).set(auth).send({}).expect(400);
    await http().post(path(emptyProjectId)).set(auth).send({ ...body, userId: randomUUID() }).expect(400);
    await http().get('/projects/not-a-uuid/pipeline').set(auth).expect(400);
    expect((await pool.query('select branch from pipeline_configs where project_id=$1', [projectId])).rows[0].branch).toBe('develop');
  });

  it('denies a user outside the project organization (403) on every route', async () => {
    const auth = { Authorization: `Bearer ${outsiderToken}` };
    await http().get(path(projectId)).set(auth).expect(403);
    await http().patch(path(projectId)).set(auth).send({ branch: 'hijack' }).expect(403);
    await http().post(path(projectId)).set(auth).send(body).expect(403);
    await http().post(path(otherProjectId)).set({ Authorization: `Bearer ${memberToken}` }).send(body).expect(403);
  });

  it('returns 404 for a missing project or a project without a configuration', async () => {
    const auth = { Authorization: `Bearer ${memberToken}` };
    await http().get(path(randomUUID())).set(auth).expect(404);
    await http().post(path(randomUUID())).set(auth).send(body).expect(404);
    const missing = await http().get(path(emptyProjectId)).set(auth).expect(404);
    expect(missing.body.message).toMatch(/Pipeline configuration not found/);
    await http().patch(path(emptyProjectId)).set(auth).send({ branch: 'main' }).expect(404);
  });

  it('defaults framework to the project framework when omitted', async () => {
    const { framework: _omitted, ...withoutFramework } = body;
    const res = await http().post(path(emptyProjectId)).set('Authorization', `Bearer ${memberToken}`).send(withoutFramework).expect(201);
    expect(res.body.framework).toBe('foundry');
  });

  it('enforces one configuration per project in the database itself', async () => {
    await expect(pool.query("insert into pipeline_configs(project_id,name,repository,branch,framework,stages) values($1,'x','a/b','main','hardhat','[\"test\"]')", [projectId]))
      .rejects.toMatchObject({ code: '23505' });
  });
});
