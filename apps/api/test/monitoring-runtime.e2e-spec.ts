import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { Interface } from 'ethers';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { MonitoringService } from '../src/monitoring/monitoring.service.js';
import { MonitoringAuthGuard } from '../src/monitoring/monitoring-auth.guard.js';
import {
  MonitoringProjectsController,
  MonitoringRuntimeController,
} from '../src/monitoring/runtime.controller.js';
import { MonitoringRuntimeService } from '../src/monitoring/runtime.service.js';
import {
  RegistryGateway,
  type RegistryContract,
} from '../src/monitoring/registry.gateway.js';
import {
  ChainGateway,
  type ChainLog,
  quantity,
} from '../src/monitoring/chain.gateway.js';
import { MonitoringWorker } from '../src/monitoring/monitoring.worker.js';

// External chain/registry fixtures are test-only. Production APIs have no fixture mode.
describe.skipIf(!process.env.MONITORING_TEST_DATABASE_URL)(
  'M3 runtime PostgreSQL vertical slice',
  () => {
    let admin: pg.Client,
      pool: pg.Pool,
      app: INestApplication,
      auth: AuthService,
      worker: MonitoringWorker;
    let access: string,
      monitorId: string,
      ruleId: string,
      eventId: string,
      alertId: string;
    const schema = `m3_runtime_${randomUUID().replaceAll('-', '')}`;
    const userId = randomUUID(),
      otherUser = randomUUID(),
      projectId = randomUUID(),
      otherProject = randomUUID(),
      orgId = randomUUID(),
      otherOrg = randomUUID(),
      registryId = randomUUID();
    const abi = ['event Withdrawal(address indexed owner,uint256 amount)'];
    const iface = new Interface(abi),
      address = '0x' + '34'.repeat(20),
      timestamp = Math.floor(Date.now() / 1000) - 60;
    const registryContract: RegistryContract = {
      id: registryId,
      projectId,
      name: 'Vault',
      version: 'v1',
      network: 'sepolia',
      address,
      abi,
    };
    const registry = {
      list: vi.fn(async (p: string) => ({
        available: true,
        message: null,
        contracts: p === projectId ? [registryContract] : [],
      })),
      get: vi.fn(async (p: string, id: string) => {
        if (p !== projectId || id !== registryId)
          throw new Error('Missing registry contract');
        return registryContract;
      }),
    };
    const encoded = iface.encodeEventLog(iface.getEvent('Withdrawal')!, [
      '0x' + '12'.repeat(20),
      '9007199254740993',
    ]);
    const known: ChainLog = {
      address,
      ...encoded,
      blockNumber: '0x64',
      blockHash: '0x' + 'a1'.repeat(32),
      transactionHash: '0x' + 'b2'.repeat(32),
      transactionIndex: '0x0',
      logIndex: '0x1',
    };
    const unknown: ChainLog = {
      ...known,
      blockNumber: '0x65',
      blockHash: '0x' + 'a2'.repeat(32),
      transactionHash: '0x' + 'b3'.repeat(32),
      topics: ['0x' + '00'.repeat(32)],
      data: '0x',
      logIndex: '0x0',
    };
    let logs = [known, unknown],
      rpcFailure = false;
    const chain = {
      configured: () => true,
      head: async () => {
        if (rpcFailure) throw new Error('secret-rpc-token');
        return 120;
      },
      logs: async (_address: string, from: number, to: number) =>
        logs.filter(
          (l) =>
            quantity(l.blockNumber) >= from && quantity(l.blockNumber) <= to,
        ),
      block: async (number: number) => ({
        hash: number === 100 ? known.blockHash : unknown.blockHash,
        number: '0x' + number.toString(16),
        timestamp: '0x' + timestamp.toString(16),
      }),
    };
    const route = (path: string, p = projectId) =>
      `/projects/${p}/monitoring/${path}`;
    const due = () =>
      pool.query(
        'update monitoring_jobs set next_run_at=now() where monitored_contract_id=$1',
        [monitorId],
      );
    beforeAll(async () => {
      vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
      vi.stubEnv('AUTH_JWT_SECRET', 'm3-runtime-test-secret-'.repeat(4));
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
      for (const file of [
        '001_core_schema.sql',
        '002_authentication.sql',
        '003_password_resets.sql',
        '004_contract_artifacts.sql',
        '004_monitoring_configuration.sql',
        '005_monitoring_runtime.sql',
      ])
        await pool.query(
          await readFile(
            new URL(`../migrations/${file}`, import.meta.url),
            'utf8',
          ),
        );
      await pool.query(
        await readFile(
          new URL('../migrations/005_monitoring_runtime.sql', import.meta.url),
          'utf8',
        ),
      );
      const db = {
        query: (sql: string, args?: unknown[]) => pool.query(sql, args),
        transaction: async (work: (c: pg.PoolClient) => Promise<unknown>) => {
          const c = await pool.connect();
          try {
            await c.query('begin');
            const result = await work(c);
            await c.query('commit');
            return result;
          } catch (error) {
            await c.query('rollback');
            throw error;
          } finally {
            c.release();
          }
        },
      } as DatabaseService;
      for (const [id, email] of [
        [userId, 'runtime@example.test'],
        [otherUser, 'other@example.test'],
      ])
        await pool.query(
          "insert into users(id,full_name,email,email_verified_at) values($1,'Runtime tester',$2,now())",
          [id, email],
        );
      for (const [org, owner, p, slug] of [
        [orgId, userId, projectId, 'runtime'],
        [otherOrg, otherUser, otherProject, 'other'],
      ]) {
        await pool.query(
          "insert into organizations(id,name,slug,created_by_id) values($1,'Test workspace',$2,$3)",
          [org, slug, owner],
        );
        await pool.query(
          'insert into organization_members(organization_id,user_id) values($1,$2)',
          [org, owner],
        );
        await pool.query(
          "insert into projects(id,organization_id,name,slug,created_by_id) values($1,$2,'Runtime project',$3,$4)",
          [p, org, slug, owner],
        );
      }
      auth = new AuthService(db);
      access = (await auth.createSession(userId)).access;
      const module = await Test.createTestingModule({
        controllers: [
          MonitoringRuntimeController,
          MonitoringProjectsController,
        ],
        providers: [
          MonitoringService,
          MonitoringRuntimeService,
          MonitoringAuthGuard,
          MonitoringWorker,
          { provide: DatabaseService, useValue: db },
          { provide: AuthService, useValue: auth },
          { provide: RegistryGateway, useValue: registry },
          { provide: ChainGateway, useValue: chain },
        ],
      }).compile();
      app = module.createNestApplication();
      app.use(cookieParser());
      await app.init();
      worker = module.get(MonitoringWorker);
    }, 60000);
    afterAll(async () => {
      await app?.close();
      await pool?.end();
      if (admin) {
        const tables = [
          'monitoring_alert_outbox',
          'monitoring_alert_history',
          'monitoring_alerts',
          'monitoring_events',
          'monitoring_subscriptions',
          'monitoring_jobs',
          'alert_rules',
          'monitored_contracts',
          'contract_artifacts',
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
        for (const table of tables)
          await admin.query(`drop table if exists "${schema}"."${table}"`);
        await admin.query(
          `drop function if exists "${schema}".chainops_set_updated_at()`,
        );
        await admin.query(`drop schema "${schema}"`);
        await admin.end();
      }
      vi.unstubAllEnvs();
    });

    it('requires authentication and CSRF on cookie-authenticated writes while supporting existing Bearer clients', async () => {
      await request(app.getHttpServer())
        .get('/monitoring/projects')
        .expect(401);
      const projects = await request(app.getHttpServer())
        .get('/monitoring/projects')
        .set('Cookie', `chainops_access=${access}`)
        .expect(200);
      expect(projects.body).toHaveLength(1);
      expect(projects.body[0].id).toBe(projectId);
      await request(app.getHttpServer())
        .post(route('test-connection'))
        .set('Cookie', `chainops_access=${access}`)
        .send({})
        .expect(403);
      const csrf = 'x'.repeat(43);
      await request(app.getHttpServer())
        .post(route('test-connection'))
        .set('Cookie', `chainops_access=${access}; chainops_csrf=${csrf}`)
        .set('Origin', 'http://localhost:5173')
        .set('X-CSRF-Token', csrf)
        .send({})
        .expect(200);
      await request(app.getHttpServer())
        .post(route('test-connection'))
        .auth(access, { type: 'bearer' })
        .send({})
        .expect(200);
    });
    it('consumes a registry target, prevents duplicates and persists ABI-derived subscriptions and watcher settings', async () => {
      const created = await request(app.getHttpServer())
        .post(route('targets'))
        .auth(access, { type: 'bearer' })
        .send({ registryContractId: registryId })
        .expect(201);
      monitorId = created.body.id;
      await request(app.getHttpServer())
        .post(route('targets'))
        .auth(access, { type: 'bearer' })
        .send({ registryContractId: registryId })
        .expect(409);
      const catalog = await request(app.getHttpServer())
        .get(route(`watchers/${monitorId}/catalog`))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(catalog.body.events[0].signature).toBe(
        'Withdrawal(address,uint256)',
      );
      await request(app.getHttpServer())
        .post(route(`watchers/${monitorId}/subscriptions`))
        .auth(access, { type: 'bearer' })
        .send({ signature: 'NotInABI()' })
        .expect(400);
      await request(app.getHttpServer())
        .post(route(`watchers/${monitorId}/subscriptions`))
        .auth(access, { type: 'bearer' })
        .send({ signature: 'Withdrawal(address,uint256)' })
        .expect(201);
      await request(app.getHttpServer())
        .post(route(`watchers/${monitorId}/subscriptions`))
        .auth(access, { type: 'bearer' })
        .send({ signature: 'Withdrawal(address,uint256)' })
        .expect(409);
      await request(app.getHttpServer())
        .patch(route(`watchers/${monitorId}`))
        .auth(access, { type: 'bearer' })
        .send({
          enabled: true,
          pollingSeconds: 2,
          confirmations: 12,
          startBlock: '100',
        })
        .expect(200);
      expect(
        (
          await pool.query(
            'select enabled,start_block::text as start from monitored_contracts where id=$1',
            [monitorId],
          )
        ).rows[0],
      ).toEqual({ enabled: true, start: '100' });
    });
    it('persists parameter and event-count rules with exact threshold strings', async () => {
      const rule = {
        name: 'Large withdrawal',
        monitoredContractId: monitorId,
        eventName: 'Withdrawal',
        condition: {
          field: 'amount',
          operator: 'gt',
          value: '9007199254740992',
        },
        severity: 'critical',
        mode: 'parameter',
        enabled: true,
      };
      const created = await request(app.getHttpServer())
        .post(route('rules'))
        .auth(access, { type: 'bearer' })
        .send(rule)
        .expect(201);
      ruleId = created.body.id;
      await request(app.getHttpServer())
        .post(route('rules'))
        .auth(access, { type: 'bearer' })
        .send({
          ...rule,
          name: 'Withdrawal count',
          condition: { field: 'count', operator: 'gte', value: '1' },
          mode: 'count',
          windowSeconds: 3600,
        })
        .expect(201);
      const listed = await request(app.getHttpServer())
        .get(route('rules'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(listed.body).toHaveLength(2);
      expect(listed.body[0].condition.value).toBe(rule.condition.value);
    });
    it('indexes real-format ABI logs, stores unknown-log evidence, evaluates rules and enqueues M5 outcomes', async () => {
      expect(await worker.tick()).toBe(true);
      const events = await request(app.getHttpServer())
        .get(route('events'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(events.body.total).toBe(2);
      const decoded = events.body.items.find(
        (e: { eventName: string }) => e.eventName === 'Withdrawal',
      );
      eventId = decoded.id;
      expect(decoded.args.amount).toBe('9007199254740993');
      expect(
        events.body.items.some((e: { decodeError: string }) =>
          Boolean(e.decodeError),
        ),
      ).toBe(true);
      const alerts = await request(app.getHttpServer())
        .get(route('alerts'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(alerts.body.total).toBe(2);
      alertId = alerts.body.items.find(
        (a: { ruleId: string }) => a.ruleId === ruleId,
      ).id;
      expect(
        (
          await pool.query(
            'select count(*)::int as n from monitoring_alert_outbox',
          )
        ).rows[0].n,
      ).toBe(2);
      const overview = await request(app.getHttpServer())
        .get(route('overview'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(overview.body.monitors[0].status).toBe('healthy');
    });
    it('replays checkpoints without duplicate events, alerts or notification outcomes', async () => {
      await due();
      await Promise.all([worker.tick(), worker.tick()]);
      expect(
        (await pool.query('select count(*)::int as n from monitoring_events'))
          .rows[0].n,
      ).toBe(2);
      expect(
        (await pool.query('select count(*)::int as n from monitoring_alerts'))
          .rows[0].n,
      ).toBe(2);
      expect(
        (
          await pool.query(
            'select count(*)::int as n from monitoring_alert_outbox',
          )
        ).rows[0].n,
      ).toBe(2);
    });
    it('enforces cross-project isolation, validates filters and returns decoded detail and neighbors', async () => {
      for (const path of [
        'overview',
        'watchers',
        'events',
        'rules',
        'alerts',
        `events/${eventId}`,
        `alerts/${alertId}`,
      ])
        await request(app.getHttpServer())
          .get(route(path, otherProject))
          .auth(access, { type: 'bearer' })
          .expect(404);
      await request(app.getHttpServer())
        .post(route('targets', otherProject))
        .auth(access, { type: 'bearer' })
        .send({ registryContractId: registryId })
        .expect(404);
      await request(app.getHttpServer())
        .get(route('events?page=-1'))
        .auth(access, { type: 'bearer' })
        .expect(400);
      const detail = await request(app.getHttpServer())
        .get(route(`events/${eventId}`))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(detail.body.abi).toEqual(abi);
      expect(detail.body.rawLog.transactionHash).toBe(known.transactionHash);
      const filtered = await request(app.getHttpServer())
        .get(route('events?eventName=Withdrawal&limit=1'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(filtered.body.total).toBe(1);
    });
    it('atomically acknowledges/resolves with actor, timestamps, notes and preserved evidence', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          request(app.getHttpServer())
            .post(route(`alerts/${alertId}/acknowledge`))
            .auth(access, { type: 'bearer' })
            .send({ note: 'Investigating' }),
        ),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      await request(app.getHttpServer())
        .post(route(`alerts/${alertId}/resolve`))
        .auth(access, { type: 'bearer' })
        .send({ note: 'Reviewed evidence' })
        .expect(200);
      await request(app.getHttpServer())
        .post(route(`alerts/${alertId}/resolve`))
        .auth(access, { type: 'bearer' })
        .send({})
        .expect(409);
      const detail = await request(app.getHttpServer())
        .get(route(`alerts/${alertId}`))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(detail.body).toMatchObject({
        status: 'resolved',
        acknowledgedBy: 'Runtime tester',
        resolvedBy: 'Runtime tester',
        eventId,
      });
      expect(
        detail.body.history.map((h: { action: string }) => h.action),
      ).toEqual(['triggered', 'acknowledged', 'resolved']);
      expect(detail.body.evidence.observed).toBe('9007199254740993');
    });
    it('reconciles shallow reorgs without deleting historical evidence or generating duplicate alerts', async () => {
      logs = [];
      await due();
      await worker.tick();
      expect(
        (
          await pool.query(
            'select count(*)::int as n from monitoring_events where removed',
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await pool.query(
            'select count(*)::int as n from monitoring_alerts where invalidated_at is not null',
          )
        ).rows[0].n,
      ).toBe(2);
      const other = (
        await pool.query('select id from monitoring_alerts where id<>$1', [
          alertId,
        ])
      ).rows[0].id;
      await request(app.getHttpServer())
        .post(route(`alerts/${other}/acknowledge`))
        .auth(access, { type: 'bearer' })
        .send({})
        .expect(409);
      logs = [known, unknown];
      await due();
      await worker.tick();
      expect(
        (
          await pool.query(
            'select count(*)::int as n from monitoring_events where not removed',
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (await pool.query('select count(*)::int as n from monitoring_alerts'))
          .rows[0].n,
      ).toBe(2);
    });
    it('records truthful RPC failure and backoff without exposing credentials, then pauses the watcher', async () => {
      rpcFailure = true;
      await due();
      await worker.tick();
      const job = (
        await pool.query(
          'select last_error,failures from monitoring_jobs where monitored_contract_id=$1',
          [monitorId],
        )
      ).rows[0];
      expect(job.failures).toBe(1);
      expect(job.last_error).not.toContain('secret-rpc-token');
      const watchers = await request(app.getHttpServer())
        .get(route('watchers'))
        .auth(access, { type: 'bearer' })
        .expect(200);
      expect(watchers.body.items[0].status).toBe('degraded');
      await request(app.getHttpServer())
        .patch(route(`watchers/${monitorId}`))
        .auth(access, { type: 'bearer' })
        .send({ enabled: false, pollingSeconds: 2, confirmations: 12 })
        .expect(200);
      await due();
      expect(await worker.tick()).toBe(false);
    });
  },
);
