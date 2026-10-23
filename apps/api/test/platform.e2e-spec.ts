import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionGuard } from '../src/auth/session.guard.js';
import { EnvironmentsController, InvitationsController, NotificationsController, OrganizationsController, ProjectsController, SearchController } from '../src/platform/platform.controllers.js';
import { EnvironmentsService } from '../src/platform/environments.service.js';
import { InvitationsService } from '../src/platform/invitations.service.js';
import { NotificationsService } from '../src/platform/notifications.service.js';
import { OrganizationsService } from '../src/platform/organizations.service.js';
import { ProjectsService } from '../src/platform/projects.service.js';
import { SearchService } from '../src/platform/search.service.js';

// Explicit opt-in only (same variable as the auth suite). Every table lives in a
// uniquely named test schema that is dropped afterwards; no shared data is touched.
describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)('platform API (PostgreSQL integration)', () => {
  let pool: pg.Pool, admin: pg.Client, app: INestApplication, notifications: NotificationsService;
  const schema = `platform_test_${randomUUID().replaceAll('-', '')}`;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173'); vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4)); vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
    vi.stubEnv('PLATFORM_SECRETS_KEY', Buffer.alloc(32, 7).toString('base64'));
    vi.stubEnv('AUTH_SMTP_URL', ''); vi.stubEnv('AUTH_EMAIL_FROM', '');
    admin = new pg.Client({ connectionString: process.env.AUTH_TEST_DATABASE_URL }); await admin.connect();
    await admin.query(`create schema "${schema}"`);
    pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    for (const name of ['001_core_schema.sql', '002_authentication.sql', '003_password_resets.sql', '004_contract_artifacts.sql', '004_monitoring_configuration.sql',
      '004_pipeline_configs.sql', '004_security_governance.sql', '005_pipeline_execution.sql', '006_platform.sql']) {
      await pool.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    const db = { query: (sql: string, args?: unknown[]) => pool.query(sql, args), transaction: async (work: (c: pg.PoolClient) => Promise<unknown>) => {
      const c = await pool.connect(); try { await c.query('begin'); const value = await work(c); await c.query('commit'); return value; } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    } } as DatabaseService;
    const auth = new AuthService(db);
    for (const who of ['owner', 'dev', 'invitee', 'stranger']) {
      ids[who] = (await pool.query<{ id: string }>('insert into users(full_name,email,email_verified_at) values($1,$2,now()) returning id', [who, `${who}@example.test`])).rows[0].id;
      tokens[who] = (await auth.createSession(ids[who])).access;
    }
    notifications = new NotificationsService(db);
    const invitations = new InvitationsService(db, notifications);
    const module = await Test.createTestingModule({
      controllers: [OrganizationsController, ProjectsController, InvitationsController, NotificationsController, EnvironmentsController, SearchController],
      providers: [
        { provide: AuthService, useValue: auth }, SessionGuard,
        { provide: NotificationsService, useValue: notifications }, { provide: InvitationsService, useValue: invitations },
        { provide: OrganizationsService, useValue: new OrganizationsService(db, invitations) },
        { provide: ProjectsService, useValue: new ProjectsService(db, invitations) },
        { provide: EnvironmentsService, useValue: new EnvironmentsService(db) }, { provide: SearchService, useValue: new SearchService(db) },
      ],
    }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); await app.init();
  }, 90000);

  afterAll(async () => {
    await app?.close(); await pool?.end();
    if (admin) { await admin.query(`drop schema if exists "${schema}" cascade`); await admin.end(); }
    vi.unstubAllEnvs();
  });

  it('creates an organization with the creator as Owner and rejects a taken slug (409)', async () => {
    await http().post('/organizations').send({ name: 'Acme', slug: 'acme' }).expect(401);
    const org = await http().post('/organizations').set(as('owner')).send({ name: 'Acme', slug: 'acme', teamSize: '2-10' }).expect(201);
    expect(org.body).toMatchObject({ name: 'Acme', slug: 'acme', role: 'owner', teamSize: '2-10' });
    ids.org = org.body.id;
    await http().post('/organizations').set(as('stranger')).send({ name: 'Other', slug: 'acme' }).expect(409);
    await http().post('/organizations').set(as('stranger')).send({ name: 'Other', slug: 'Bad Slug' }).expect(400);
    const strangerOrg = await http().post('/organizations').set(as('stranger')).send({ name: 'Stranger Org', slug: 'stranger-org' }).expect(201);
    ids.strangerOrg = strangerOrg.body.id;
    // Organizations outside your memberships are not disclosed.
    await http().get(`/organizations/${ids.org}`).set(as('stranger')).expect(404);
  });

  it('invites by email with a role; only the invited, signed-in user can accept', async () => {
    const sent = await http().post(`/organizations/${ids.org}/invitations`).set(as('owner')).send({ email: 'dev@example.test', role: 'developer' }).expect(201);
    expect(sent.body).toMatchObject({ delivery: 'link', invitation: { status: 'pending', role: 'developer' } });
    expect(sent.body.inviteLink).toMatch(/\/invitations#token=[\w-]{43}$/);
    const token = sent.body.inviteLink.split('token=')[1];
    expect((await pool.query('select token_hash from invitations where id = $1', [sent.body.invitation.id])).rows[0].token_hash).not.toBe(token);
    await http().post(`/organizations/${ids.org}/invitations`).set(as('owner')).send({ email: 'dev@example.test', role: 'viewer' }).expect(409);
    await http().get(`/invitations/by-token/${token}`).set(as('stranger')).expect(403);
    const mine = await http().get('/invitations/mine').set(as('dev')).expect(200);
    expect(mine.body).toHaveLength(1);
    await http().post(`/invitations/${sent.body.invitation.id}/accept`).set(as('stranger')).expect(404);
    await http().post(`/invitations/${sent.body.invitation.id}/accept`).set(as('dev')).expect(200);
    const members = await http().get(`/organizations/${ids.org}/members`).set(as('owner')).expect(200);
    expect(members.body.members.map((m: { email: string; role: string }) => `${m.email}:${m.role}`)).toEqual(['owner@example.test:owner', 'dev@example.test:developer']);
    // The inviter is notified once; repeated delivery of the same event is ignored.
    const inbox = await http().get('/notifications').set(as('owner')).expect(200);
    expect(inbox.body.items.filter((n: { type: string }) => n.type === 'member_joined')).toHaveLength(1);
  });

  it('enforces organization roles server-side (403) and keeps at least one Owner (409)', async () => {
    await http().patch(`/organizations/${ids.org}`).set(as('dev')).send({ name: 'Hijack' }).expect(403);
    await http().post(`/organizations/${ids.org}/invitations`).set(as('dev')).send({ email: 'x@example.test', role: 'viewer' }).expect(403);
    await http().patch(`/organizations/${ids.org}/members/${ids.owner}`).set(as('owner')).send({ role: 'viewer' }).expect(409);
    await http().patch(`/organizations/${ids.org}`).set(as('owner')).send({ name: 'Acme Labs' }).expect(200);
  });

  it('runs the project wizard: draft invitations are sent only when setup completes', async () => {
    const project = await http().post(`/organizations/${ids.org}/projects`).set(as('dev')).send({ name: 'Chain Vault', description: 'Treasury', framework: 'hardhat', defaultBranch: 'main' }).expect(201);
    expect(project.body).toMatchObject({ slug: 'chain-vault', setupComplete: false, access: { projectRole: 'owner', canManage: true } });
    ids.project = project.body.id;
    const draft = await http().post(`/projects/${ids.project}/invitations`).set(as('dev')).send({ email: 'invitee@example.test', role: 'reviewer' }).expect(201);
    expect(draft.body).toMatchObject({ delivery: 'draft', inviteLink: null, invitation: { status: 'draft' } });
    expect((await http().get('/invitations/mine').set(as('invitee'))).body).toEqual([]);
    // Setup cannot complete before the pipeline (M1 steps) is configured.
    await http().post(`/projects/${ids.project}/complete-setup`).set(as('dev')).expect(409);
    await pool.query("insert into pipeline_configs (project_id, name, repository, branch, framework, stages) values ($1, 'CI', 'acme/vault', 'main', 'hardhat', '[\"checkout\",\"build\"]')", [ids.project]);
    const done = await http().post(`/projects/${ids.project}/complete-setup`).set(as('dev')).expect(200);
    expect(done.body.invitations).toHaveLength(1);
    const mine = (await http().get('/invitations/mine').set(as('invitee')).expect(200)).body;
    expect(mine[0]).toMatchObject({ projectName: 'Chain Vault', role: 'reviewer' });
    await http().post(`/invitations/${mine[0].id}/accept`).set(as('invitee')).expect(200);
    const team = await http().get(`/projects/${ids.project}/team`).set(as('invitee')).expect(200);
    expect(team.body.members.map((m: { email: string; role: string }) => `${m.email}:${m.role}`)).toEqual(['dev@example.test:owner', 'invitee@example.test:reviewer']);
    // A Reviewer can read the project but not change it.
    await http().patch(`/projects/${ids.project}`).set(as('invitee')).send({ description: 'x' }).expect(403);
    expect((await http().get('/projects/chain-vault').set(as('invitee')).expect(200)).body.access).toMatchObject({ projectRole: 'reviewer', canManage: false });
  });

  it('stores RPC URLs encrypted and returns only a masked form', async () => {
    await http().post(`/projects/${ids.project}/environments`).set(as('dev')).send({ name: 'Sepolia', network: 'sepolia', chainId: 11155111, rpcUrl: 'http://sepolia.example/v3/abc' }).expect(400);
    await http().post(`/projects/${ids.project}/environments`).set(as('dev')).send({ name: 'Sepolia', network: 'sepolia', chainId: 1, rpcUrl: 'https://sepolia.infura.io/v3/abc' }).expect(400);
    const env = await http().post(`/projects/${ids.project}/environments`).set(as('dev')).send({ name: 'Sepolia Testnet', network: 'sepolia', chainId: 11155111, rpcUrl: 'https://sepolia.infura.io/v3/super-secret-key' }).expect(201);
    expect(env.body.rpcUrlMasked).toBe('https://sepolia.infura.io/v3/••••••••');
    expect(JSON.stringify(env.body)).not.toContain('super-secret-key');
    const stored = (await pool.query('select rpc_url_encrypted from environments where id = $1', [env.body.id])).rows[0].rpc_url_encrypted;
    expect(stored).toMatch(/^v1:/); expect(stored).not.toContain('super-secret-key');
    ids.env = env.body.id;
    await http().post(`/projects/${ids.project}/environments`).set(as('invitee')).send({ name: 'X', network: 'hardhat-local', chainId: 31337, rpcUrl: 'http://127.0.0.1:8545' }).expect(403);
  });

  it('never returns secret variable values; a secret becomes visible only with a new value', async () => {
    const secret = await http().post(`/projects/${ids.project}/variables`).set(as('dev')).send({ key: 'PRIVATE_KEY', value: '0xdeadbeef', environmentId: ids.env }).expect(201);
    expect(secret.body).toMatchObject({ key: 'PRIVATE_KEY', isSecret: true, value: null, environmentName: 'Sepolia Testnet' });
    await http().post(`/projects/${ids.project}/variables`).set(as('dev')).send({ key: 'NETWORK_NAME', value: 'sepolia', isSecret: false }).expect(201);
    await http().post(`/projects/${ids.project}/variables`).set(as('dev')).send({ key: 'lowercase', value: 'x' }).expect(400);
    await http().post(`/projects/${ids.project}/variables`).set(as('dev')).send({ key: 'PRIVATE_KEY', value: 'again', environmentId: ids.env }).expect(409);
    const list = await http().get(`/projects/${ids.project}/variables`).set(as('invitee')).expect(200);
    expect(JSON.stringify(list.body)).not.toContain('deadbeef');
    expect(list.body.variables.find((v: { key: string }) => v.key === 'NETWORK_NAME').value).toBe('sepolia');
    await http().patch(`/projects/${ids.project}/variables/${secret.body.id}`).set(as('dev')).send({ isSecret: false }).expect(400);
    await http().delete(`/projects/${ids.project}/variables/${secret.body.id}`).set(as('invitee')).expect(403);
  });

  it('notifications: dedupe by event, unread count, mark read', async () => {
    const event = { type: 'pipeline_failed' as const, title: 'Build failed', body: 'Run #1 failed.', projectId: ids.project, dedupeKey: 'pipeline-run:test:finished', link: '/x' };
    await notifications.notify([ids.dev], event);
    await notifications.notify([ids.dev], event);
    const inbox = await http().get('/notifications').set(as('dev')).expect(200);
    const failed = inbox.body.items.filter((n: { type: string }) => n.type === 'pipeline_failed');
    expect(failed).toHaveLength(1);
    await http().post(`/notifications/${failed[0].id}/read`).set(as('stranger')).expect(404);
    await http().post(`/notifications/${failed[0].id}/read`).set(as('dev')).expect(200);
    await http().post('/notifications/read-all').set(as('dev')).expect(200);
    expect((await http().get('/notifications').set(as('dev'))).body.unreadCount).toBe(0);
  });

  it('search only returns resources in the user\'s organizations', async () => {
    expect((await http().get('/search?q=vault').set(as('invitee')).expect(200)).body.results.map((r: { title: string }) => r.title)).toEqual(['Chain Vault']);
    expect((await http().get('/search?q=vault').set(as('stranger')).expect(200)).body.results).toEqual([]);
    await http().get('/search?q=v').set(as('dev')).expect(400);
    await http().get(`/projects/${ids.project}/overview`).set(as('stranger')).expect(404);
    const overview = await http().get(`/projects/${ids.project}/overview`).set(as('invitee')).expect(200);
    expect(overview.body).toMatchObject({ repository: { repository: 'acme/vault' }, latestRun: null, environments: [{ name: 'Sepolia Testnet', chainId: 11155111 }] });
    expect(overview.body.activity).toHaveLength(14);
  });
});
