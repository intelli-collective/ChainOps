import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AccessTokenGuard } from '../src/pipelines/access-token.guard.js';
import { GitHubService } from '../src/pipelines/github.service.js';
import { PipelineConfigService } from '../src/pipelines/pipeline-config.service.js';
import { PipelineRunsController } from '../src/pipelines/pipeline-runs.controller.js';
import { PipelineRunsService } from '../src/pipelines/pipeline-runs.service.js';
import { PipelineWorkerService } from '../src/pipelines/pipeline-worker.service.js';

// Explicit opt-in only (same variable as the auth suite). Every table lives in a
// uniquely named test schema that is dropped afterwards; no shared data is touched.
describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)('pipeline runs API and worker (PostgreSQL integration)', () => {
  let pool: pg.Pool, admin: pg.Client, app: INestApplication, db: DatabaseService;
  const schema = `pipeline_runs_test_${randomUUID().replaceAll('-', '')}`;
  const ORIGIN = 'http://localhost:5173';
  const MAIN_SHA = 'a'.repeat(40);
  const DEV_SHA = 'b'.repeat(40);
  let memberToken: string, outsiderToken: string, projectId: string, emptyProjectId: string, memberId: string;
  const http = () => request(app.getHttpServer());
  const runs = (id: string) => `/projects/${id}/pipeline/runs`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  // GitHub is stubbed: branch heads come from this map instead of the network.
  const github = {
    resolveBranch: async (_repo: string, branch: string) => {
      const sha = ({ main: MAIN_SHA, develop: DEV_SHA } as Record<string, string>)[branch];
      if (!sha) throw new BadRequestException(`Branch "${branch}" was not found.`);
      return sha;
    },
    listBranches: async () => [{ name: 'develop', commitSha: DEV_SHA }, { name: 'main', commitSha: MAIN_SHA }],
  } as unknown as GitHubService;

  beforeAll(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', ORIGIN); vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4)); vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
    admin = new pg.Client({ connectionString: process.env.AUTH_TEST_DATABASE_URL }); await admin.connect();
    await admin.query(`create schema "${schema}"`);
    pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    for (const name of ['001_core_schema.sql', '002_authentication.sql', '003_password_resets.sql', '004_pipeline_configs.sql', '005_pipeline_execution.sql']) {
      await pool.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    db = { query: (sql: string, args?: unknown[]) => pool.query(sql, args), transaction: async (work: (c: pg.PoolClient) => Promise<unknown>) => {
      const c = await pool.connect(); try { await c.query('begin'); const value = await work(c); await c.query('commit'); return value; } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    } } as DatabaseService;

    const user = async (email: string) => (await pool.query<{ id: string }>('insert into users(full_name,email,email_verified_at) values($1,$2,now()) returning id', [email, email])).rows[0].id;
    memberId = await user('member@example.test');
    const outsider = await user('outsider@example.test');
    const org = (await pool.query<{ id: string }>("insert into organizations(name,slug,created_by_id) values('Org','org',$1) returning id", [memberId])).rows[0].id;
    await pool.query('insert into organization_members(organization_id,user_id) values($1,$2)', [org, memberId]);
    const project = async (slug: string) => (await pool.query<{ id: string }>("insert into projects(organization_id,name,slug,framework,created_by_id) values($1,$2,$2,'hardhat',$3) returning id", [org, slug, memberId])).rows[0].id;
    projectId = await project('chainvault');
    emptyProjectId = await project('token-factory');

    const auth = new AuthService(db);
    memberToken = (await auth.createSession(memberId)).access;
    outsiderToken = (await auth.createSession(outsider)).access;
    const configs = new PipelineConfigService(db, github);
    const module = await Test.createTestingModule({
      controllers: [PipelineRunsController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PipelineRunsService, useValue: new PipelineRunsService(db, github, configs) },
        AccessTokenGuard,
      ],
    }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); await app.init();
  }, 60000);

  afterAll(async () => {
    await app?.close(); await pool?.end();
    if (admin) { await admin.query(`drop schema if exists "${schema}" cascade`); await admin.end(); }
    vi.unstubAllEnvs();
  });

  it('refuses to start a run before the pipeline is configured (409) and requires a token (401)', async () => {
    await http().post(runs(projectId)).send({}).expect(401);
    const res = await http().post(runs(projectId)).set(bearer(memberToken)).send({}).expect(409);
    expect(res.body.message).toMatch(/Configure the pipeline/);
  });

  it('creates a queued run pinned to the exact commit, with planned stages and one queue job (201)', async () => {
    await new PipelineConfigService(db, github).create(projectId, memberId, {
      name: 'CI', repository: 'intelli-collective/vault-contracts', branch: 'main', stages: ['checkout', 'build', 'test', 'slither', 'policy'],
    });
    const created = await http().post(runs(projectId)).set(bearer(memberToken)).send({}).expect(201);
    expect(created.body).toMatchObject({ runNumber: 1, status: 'queued', branch: 'main', commitSha: MAIN_SHA, trigger: 'manual', author: 'member@example.test' });
    const detail = await http().get(`${runs(projectId)}/${created.body.id}`).set(bearer(memberToken)).expect(200);
    expect(detail.body.stages.map((s: { key: string; status: string }) => `${s.key}:${s.status}`))
      .toEqual(['checkout:pending', 'build:pending', 'test:pending', 'slither:skipped', 'policy:skipped']);
    expect(detail.body.stages[3].skipReason).toMatch(/Security module \(M4\)/);
    expect(detail.body.config).toMatchObject({ buildCommand: 'npx hardhat compile', testCommand: 'npx hardhat test' });
    const job = await pool.query('select status from pipeline_jobs where run_id = $1', [created.body.id]);
    expect(job.rows).toEqual([{ status: 'queued' }]);
  });

  it('numbers runs per project and lists them newest first; a chosen branch resolves to its own commit', async () => {
    const second = await http().post(runs(projectId)).set(bearer(memberToken)).send({ branch: 'develop' }).expect(201);
    expect(second.body).toMatchObject({ runNumber: 2, branch: 'develop', commitSha: DEV_SHA });
    const list = await http().get(runs(projectId)).set(bearer(memberToken)).expect(200);
    expect(list.body.map((run: { runNumber: number }) => run.runNumber)).toEqual([2, 1]);
  });

  it('validates the request body and branch (400)', async () => {
    await http().post(runs(projectId)).set(bearer(memberToken)).send({ branch: 'missing-branch' }).expect(400);
    await http().post(runs(projectId)).set(bearer(memberToken)).send({ branch: 'bad branch;rm -rf /' }).expect(400);
    await http().post(runs(projectId)).set(bearer(memberToken)).send({ commitSha: MAIN_SHA }).expect(400);
    await http().get('/projects/not-a-uuid/pipeline/runs').set(bearer(memberToken)).expect(400);
  });

  it('accepts the session cookie, but cookie-authenticated writes need the CSRF token (403 without it)', async () => {
    const cookie = `chainops_access=${memberToken}`;
    await http().get(runs(projectId)).set('Cookie', cookie).expect(200);
    await http().post(runs(projectId)).set('Cookie', cookie).send({}).expect(403);
    const csrf = 'c'.repeat(43);
    const created = await http().post(runs(projectId)).set('Cookie', `${cookie}; chainops_csrf=${csrf}`).set('X-CSRF-Token', csrf).set('Origin', ORIGIN).send({}).expect(201);
    expect(created.body.runNumber).toBe(3);
  });

  it('cancels a queued run immediately and refuses to cancel it twice (409)', async () => {
    const run = (await http().get(runs(projectId)).set(bearer(memberToken))).body[0];
    const cancelled = await http().post(`${runs(projectId)}/${run.id}/cancel`).set(bearer(memberToken)).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'cancelled', cancelRequested: true });
    const stages = await pool.query("select count(*)::int n from pipeline_run_stages where run_id = $1 and status = 'pending'", [run.id]);
    expect(stages.rows[0].n).toBe(0);
    expect((await pool.query('select status from pipeline_jobs where run_id = $1', [run.id])).rows[0].status).toBe('done');
    await http().post(`${runs(projectId)}/${run.id}/cancel`).set(bearer(memberToken)).expect(409);
  });

  it('re-runs a finished run on the exact same commit (201) and refuses to re-run an unfinished one (409)', async () => {
    const list = (await http().get(runs(projectId)).set(bearer(memberToken))).body as { id: string; status: string; commitSha: string }[];
    const finished = list.find((run) => run.status === 'cancelled')!;
    const rerun = await http().post(`${runs(projectId)}/${finished.id}/rerun`).set(bearer(memberToken)).expect(201);
    expect(rerun.body).toMatchObject({ status: 'queued', commitSha: finished.commitSha });
    expect((await http().get(`${runs(projectId)}/${rerun.body.id}`).set(bearer(memberToken))).body.rerunOf).toBe(finished.id);
    const queued = list.find((run) => run.status === 'queued')!;
    await http().post(`${runs(projectId)}/${queued.id}/rerun`).set(bearer(memberToken)).expect(409);
  });

  it('denies non-members (403) and reports missing projects, runs and artifacts (404)', async () => {
    await http().get(runs(projectId)).set(bearer(outsiderToken)).expect(403);
    await http().post(runs(projectId)).set(bearer(outsiderToken)).send({}).expect(403);
    await http().get(runs(randomUUID())).set(bearer(memberToken)).expect(404);
    await http().get(`${runs(projectId)}/${randomUUID()}`).set(bearer(memberToken)).expect(404);
    const run = (await http().get(runs(projectId)).set(bearer(memberToken))).body[0];
    expect((await http().get(`${runs(projectId)}/${run.id}/artifacts`).set(bearer(memberToken)).expect(200)).body).toEqual([]);
    await http().get(`${runs(projectId)}/${run.id}/artifacts/${randomUUID()}`).set(bearer(memberToken)).expect(404);
    // A run belongs to its project: it is not reachable through another project id.
    await http().get(`${runs(emptyProjectId)}/${run.id}`).set(bearer(memberToken)).expect(404);
  });

  it('worker claims the oldest queued job and records an infrastructure error as "error", not "failed"', async () => {
    // The configured repository does not exist on GitHub, so the source download fails.
    await pool.query("update pipeline_runs set repository = 'chainops-test-invalid/does-not-exist-0' where status = 'queued'");
    const oldest = (await pool.query<{ id: string }>("select r.id from pipeline_jobs j join pipeline_runs r on r.id = j.run_id where j.status = 'queued' order by j.created_at limit 1")).rows[0].id;
    const worker = new PipelineWorkerService(db);
    await (worker as unknown as { tick(): Promise<void> }).tick();
    worker.onModuleDestroy();
    const run = (await pool.query('select status, failure_stage, failure_reason, started_at, finished_at from pipeline_runs where id = $1', [oldest])).rows[0];
    expect(run).toMatchObject({ status: 'error', failure_stage: 'checkout' });
    expect(run.failure_reason).toMatch(/GitHub returned 404|Could not download/);
    expect(run.started_at).not.toBeNull();
    const stages = (await pool.query('select key, status from pipeline_run_stages where run_id = $1 order by position', [oldest])).rows;
    expect(stages.map((s) => `${s.key}:${s.status}`)).toEqual(['checkout:failed', 'build:skipped', 'test:skipped', 'slither:skipped', 'policy:skipped']);
    expect((await pool.query('select status from pipeline_jobs where run_id = $1', [oldest])).rows[0].status).toBe('done');
  }, 60000);
});
