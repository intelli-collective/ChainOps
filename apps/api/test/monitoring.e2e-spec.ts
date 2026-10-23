import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { MonitoringController } from '../src/monitoring/monitoring.controller.js';
import { MonitoringService } from '../src/monitoring/monitoring.service.js';
import { MonitoringAuthGuard } from '../src/monitoring/monitoring-auth.guard.js';

// Real PostgreSQL and real JWT/session guard. No runtime authentication bypass.
describe.skipIf(!process.env.MONITORING_TEST_DATABASE_URL)(
  'monitoring PostgreSQL API integration',
  () => {
    let admin: pg.Client,
      pool: pg.Pool,
      app: INestApplication,
      auth: AuthService;
    let access: string;
    const schema = `monitoring_test_${randomUUID().replaceAll('-', '')}`;
    const userId = randomUUID(),
      outsiderId = randomUUID();
    const orgId = randomUUID(),
      foreignOrg = randomUUID();
    const projectId = randomUUID(),
      secondProjectId = randomUUID(),
      foreignProjectId = randomUUID();
    const monitor = {
      name: 'Vault Contract',
      network: 'sepolia',
      address: `0x${'aB'.repeat(20)}`,
    };
    const rule = {
      name: 'Large Withdrawal',
      eventName: 'Withdrawal',
      condition: { field: 'amount', operator: 'gt', value: '100' },
      enabled: true,
    };
    const route = (resource: string, project: string = projectId) =>
      `/projects/${project}/${resource}`;

    beforeAll(async () => {
      vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
      vi.stubEnv('AUTH_JWT_SECRET', 'monitoring-test-only-secret-'.repeat(3));
      vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
      admin = new pg.Client({
        connectionString: process.env.MONITORING_TEST_DATABASE_URL,
      });
      await admin.connect();
      await admin.query(`create schema "${schema}"`);
      pool = new pg.Pool({
        connectionString: process.env.MONITORING_TEST_DATABASE_URL,
        options: `-c search_path=${schema}`,
      });
      for (const name of [
        '001_core_schema.sql',
        '002_authentication.sql',
        '003_password_resets.sql',
        '004_monitoring_configuration.sql',
      ]) {
        await pool.query(
          await readFile(
            new URL(`../migrations/${name}`, import.meta.url),
            'utf8',
          ),
        );
      }
      // The new migration can also be safely re-applied.
      await pool.query(
        await readFile(
          new URL(
            '../migrations/004_monitoring_configuration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const db = {
        query: (sql: string, values?: unknown[]) => pool.query(sql, values),
        transaction: async (
          work: (client: pg.PoolClient) => Promise<unknown>,
        ) => {
          const client = await pool.connect();
          try {
            await client.query('begin');
            const value = await work(client);
            await client.query('commit');
            return value;
          } catch (error) {
            await client.query('rollback');
            throw error;
          } finally {
            client.release();
          }
        },
      } as DatabaseService;
      for (const [id, email] of [
        [userId, 'member@example.test'],
        [outsiderId, 'outsider@example.test'],
      ]) {
        await pool.query(
          "insert into users(id,full_name,email,email_verified_at) values($1,'Test member',$2,now())",
          [id, email],
        );
      }
      for (const [id, slug, owner] of [
        [orgId, 'members', userId],
        [foreignOrg, 'outsiders', outsiderId],
      ]) {
        await pool.query(
          "insert into organizations(id,name,slug,created_by_id) values($1,'Test organization',$2,$3)",
          [id, slug, owner],
        );
        await pool.query(
          'insert into organization_members(organization_id,user_id) values($1,$2)',
          [id, owner],
        );
      }
      for (const [id, org, slug, owner] of [
        [projectId, orgId, 'vault', userId],
        [secondProjectId, orgId, 'second', userId],
        [foreignProjectId, foreignOrg, 'foreign', outsiderId],
      ]) {
        await pool.query(
          "insert into projects(id,organization_id,name,slug,created_by_id) values($1,$2,'Test project',$3,$4)",
          [id, org, slug, owner],
        );
      }
      auth = new AuthService(db);
      access = (await auth.createSession(userId)).access;
      const module = await Test.createTestingModule({
        controllers: [MonitoringController],
        providers: [
          MonitoringService,
          MonitoringAuthGuard,
          { provide: DatabaseService, useValue: db },
          { provide: AuthService, useValue: auth },
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
    }, 60000);

    afterAll(async () => {
      await app?.close();
      await pool?.end();
      if (admin) {
        // Remove only the uniquely named test schema; no shared tables or CASCADE.
        const { rows } = await admin.query<{ tablename: string }>(
          'select tablename from pg_tables where schemaname=$1',
          [schema],
        );
        const order = [
          'alert_rules',
          'monitored_contracts',
          'password_resets',
          'oauth_attempts',
          'auth_rate_limits',
          'email_verifications',
          'refresh_tokens',
          'auth_sessions',
          'password_credentials',
          'auth_identities',
          'projects',
          'organization_members',
          'organizations',
          'users',
        ];
        for (const table of order)
          if (rows.some((row) => row.tablename === table))
            await admin.query(`drop table "${schema}"."${table}"`);
        await admin.query(
          `drop function if exists "${schema}".chainops_set_updated_at()`,
        );
        await admin.query(`drop schema "${schema}"`);
        await admin.end();
      }
      vi.unstubAllEnvs();
    });

    it('creates a normalized monitor, lists it, and verifies the persisted row and ISO timestamps', async () => {
      const created = await request(app.getHttpServer())
        .post(route('monitored-contracts'))
        .auth(access, { type: 'bearer' })
        .send(monitor)
        .expect(201);
      expect(created.body).toMatchObject({
        projectId,
        name: monitor.name,
        network: 'sepolia',
        address: monitor.address.toLowerCase(),
      });
      expect(created.body.createdAt).toMatch(/^\d{4}-.*Z$/);
      expect(new Date(created.body.createdAt).toISOString()).toBe(
        created.body.createdAt,
      );
      const listed = await request(app.getHttpServer())
        .get(route('monitored-contracts'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(listed.headers['cache-control']).toBe('no-store');
      expect(listed.body).toContainEqual(created.body);
      const persisted = await pool.query(
        'select address from monitored_contracts where id=$1 and project_id=$2',
        [created.body.id, projectId],
      );
      expect(persisted.rows).toEqual([
        { address: monitor.address.toLowerCase() },
      ]);
      await request(app.getHttpServer())
        .post(route('monitored-contracts'))
        .auth(access, { type: 'bearer' })
        .send({ ...monitor, address: monitor.address.toLowerCase() })
        .expect(409);
    });

    it('creates and lists an exact uint256 alert rule linked to a persisted monitor', async () => {
      const target = await request(app.getHttpServer())
        .post(route('monitored-contracts'))
        .auth(access, { type: 'bearer' })
        .send({ ...monitor, address: `0x${'12'.repeat(20)}` })
        .expect(201);
      const input = {
        ...rule,
        monitoredContractId: target.body.id,
        condition: { ...rule.condition, value: ((1n << 256n) - 1n).toString() },
      };
      const created = await request(app.getHttpServer())
        .post(route('alert-rules'))
        .auth(access, { type: 'bearer' })
        .send(input)
        .expect(201);
      expect(created.body).toMatchObject({ ...input, projectId });
      const listed = await request(app.getHttpServer())
        .get(route('alert-rules'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(listed.body).toContainEqual(created.body);
      const persisted = await pool.query(
        'select condition,monitored_contract_id from alert_rules where id=$1',
        [created.body.id],
      );
      expect(persisted.rows[0]).toEqual({
        condition: input.condition,
        monitored_contract_id: target.body.id,
      });
    });

    it('supports project-wide rules, enabled=false, empty lists, and per-project address uniqueness', async () => {
      const empty = await request(app.getHttpServer())
        .get(route('alert-rules', secondProjectId))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(empty.body).toEqual([]);
      await request(app.getHttpServer())
        .post(route('monitored-contracts', secondProjectId))
        .auth(access, { type: 'bearer' })
        .send(monitor)
        .expect(201);
      const created = await request(app.getHttpServer())
        .post(route('alert-rules', secondProjectId))
        .auth(access, { type: 'bearer' })
        .send({ ...rule, enabled: false })
        .expect(201);
      expect(created.body).toMatchObject({
        monitoredContractId: null,
        enabled: false,
        projectId: secondProjectId,
      });
      const listed = await request(app.getHttpServer())
        .get(route('alert-rules', secondProjectId))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(listed.body).toEqual([created.body]);
    });

    it('rejects malformed addresses, unsupported networks, unsafe conditions and client-controlled ownership', async () => {
      for (const input of [
        { ...monitor, address: '0x123' },
        { ...monitor, network: 'arbitrary' },
        { ...monitor, userId: outsiderId },
      ]) {
        await request(app.getHttpServer())
          .post(route('monitored-contracts'))
          .auth(access, { type: 'bearer' })
          .send(input)
          .expect(400);
      }
      for (const input of [
        { ...rule, condition: { ...rule.condition, operator: 'eval' } },
        { ...rule, condition: { ...rule.condition, value: 9007199254740992 } },
        { ...rule, condition: { ...rule.condition, sql: 'drop table users' } },
        { ...rule, monitoredContractId: 'invalid' },
      ]) {
        await request(app.getHttpServer())
          .post(route('alert-rules'))
          .auth(access, { type: 'bearer' })
          .send(input)
          .expect(400);
      }
    });

    it.each(['monitored-contracts', 'alert-rules'])(
      'fails closed for unauthenticated, malformed, forged, and revoked access to %s',
      async (resource) => {
        for (const method of ['get', 'post'] as const) {
          await request(app.getHttpServer())
            [method](route(resource))
            .expect(401);
          await request(app.getHttpServer())
            [method](route(resource))
            .set('Cookie', `chainops_access=${access}`)
            .expect(401);
          await request(app.getHttpServer())
            [method](route(resource))
            .set('Authorization', 'Bearer forged')
            .expect(401);
        }
        const tokens = await auth.createSession(userId);
        await auth.logout(tokens.refresh);
        await request(app.getHttpServer())
          .get(route(resource))
          .auth(tokens.access, { type: 'bearer' })
          .expect(401);
      },
    );

    it.each(['monitored-contracts', 'alert-rules'])(
      'isolates all %s routes across organizations and validates project UUIDs',
      async (resource) => {
        await request(app.getHttpServer())
          .get(route(resource, foreignProjectId))
          .auth(access, { type: 'bearer' })
          .expect(404);
        await request(app.getHttpServer())
          .post(route(resource, foreignProjectId))
          .auth(access, { type: 'bearer' })
          .send(resource === 'alert-rules' ? rule : monitor)
          .expect(404);
        await request(app.getHttpServer())
          .get(route(resource, randomUUID()))
          .auth(access, { type: 'bearer' })
          .expect(404);
        await request(app.getHttpServer())
          .get(route(resource, 'invalid'))
          .auth(access, { type: 'bearer' })
          .expect(400);
      },
    );

    it('rejects cross-project monitor links in both the API and the database', async () => {
      const target = (
        await pool.query(
          'select id from monitored_contracts where project_id=$1 limit 1',
          [projectId],
        )
      ).rows[0];
      await request(app.getHttpServer())
        .post(route('alert-rules', secondProjectId))
        .auth(access, { type: 'bearer' })
        .send({ ...rule, monitoredContractId: target.id })
        .expect(404);
      await request(app.getHttpServer())
        .post(route('alert-rules'))
        .auth(access, { type: 'bearer' })
        .send({ ...rule, monitoredContractId: randomUUID() })
        .expect(404);
      await expect(
        pool.query(
          'insert into alert_rules(project_id,monitored_contract_id,name,event_name,condition) values($1,$2,$3,$4,$5)',
          [
            secondProjectId,
            target.id,
            rule.name,
            rule.eventName,
            rule.condition,
          ],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('enforces condition constraints for direct SQL writes', async () => {
      for (const condition of [
        {},
        { ...rule.condition, value: 123 },
        { ...rule.condition, operator: 'eval' },
        { ...rule.condition, extra: 'executable' },
        { ...rule.condition, value: (1n << 256n).toString() },
      ]) {
        await expect(
          pool.query(
            'insert into alert_rules(project_id,name,event_name,condition) values($1,$2,$3,$4)',
            [projectId, rule.name, rule.eventName, condition],
          ),
        ).rejects.toMatchObject({ code: '23514' });
      }
    });

    it('checks organization membership on every request after membership removal', async () => {
      const tokens = await auth.createSession(outsiderId);
      await pool.query(
        'insert into organization_members(organization_id,user_id) values($1,$2)',
        [orgId, outsiderId],
      );
      await request(app.getHttpServer())
        .get(route('monitored-contracts'))
        .auth(tokens.access, { type: 'bearer' })
        .expect(200);
      await pool.query(
        'delete from organization_members where organization_id=$1 and user_id=$2',
        [orgId, outsiderId],
      );
      await request(app.getHttpServer())
        .get(route('monitored-contracts'))
        .auth(tokens.access, { type: 'bearer' })
        .expect(404);
    });
  },
);
