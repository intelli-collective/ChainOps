import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { SecurityPolicyController } from './security-policy.controller.js';
import { SecurityPolicyService } from './security-policy.service.js';
import { ApprovalRequestController } from './approval-request.controller.js';
import { ApprovalRequestService } from './approval-request.service.js';
import type { ApprovalRequestRow, SecurityPolicyRow } from './security-governance.types.js';

const projectA = randomUUID();
const projectB = randomUUID();
const projectC = randomUUID();
const missingProject = randomUUID();
const knownProjects: readonly string[] = [projectA, projectB, projectC];
const aliceId = randomUUID();
const bobId = randomUUID();
const csrf = 's'.repeat(43);
const policy = { name: 'Production Release Gate', blockCritical: true, blockHigh: false, requireApproval: true };
const approval = { title: 'Approve Vault v1.0 release', description: 'Testnet release request' };
const resources = [
  { segment: 'security-policies', body: policy },
  { segment: 'approval-requests', body: approval },
] as const;

describe('security governance access across all four routes', () => {
  let app: INestApplication;
  let aliceAccess: string;
  let bobAccess: string;
  let query: ReturnType<typeof vi.fn>;
  let policies: SecurityPolicyRow[];
  let approvals: ApprovalRequestRow[];
  let sessions: Map<string, string>;

  const path = (projectId: string, segment: string) => `/projects/${projectId}/${segment}`;
  const withSession = (req: request.Test, token: string) => req.set('Cookie', `chainops_access=${token}; chainops_csrf=${csrf}`);
  const asWriter = (req: request.Test, token: string) => withSession(req, token).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', csrf);

  beforeEach(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4));
    policies = [];
    approvals = [];
    sessions = new Map();
    const users = new Map<string, User>([
      [aliceId, { id: aliceId, email: 'alice@example.test', full_name: 'Alice', email_verified_at: new Date() }],
      [bobId, { id: bobId, email: 'bob@example.test', full_name: 'Bob', email_verified_at: new Date() }],
    ]);
    query = vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.includes('from users u join auth_sessions s')) {
        const userId = values[1] as string;
        return { rows: sessions.get(values[0] as string) === userId ? [users.get(userId)] : [] };
      }
      if (sql.includes('from projects p')) {
        const projectId = values[0] as string;
        const userId = values[1] as string;
        if (!knownProjects.includes(projectId)) return { rows: [] };
        const allowed = projectId === projectB ? userId === bobId : userId === aliceId;
        return { rows: [{ id: projectId, member_user_id: allowed ? userId : null }] };
      }
      if (sql.includes('insert into security_policies')) {
        const row: SecurityPolicyRow = {
          id: randomUUID(), project_id: values[0] as string, name: values[1] as string,
          block_critical: values[2] as boolean, block_high: values[3] as boolean,
          require_approval: values[4] as boolean, created_at: new Date(), updated_at: new Date(),
        };
        policies.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from security_policies')) return { rows: policies.filter(row => row.project_id === values[0]) };
      if (sql.includes('insert into approval_requests')) {
        const row: ApprovalRequestRow = {
          id: randomUUID(), project_id: values[0] as string, title: values[1] as string,
          description: values[2] as string | null, requested_by_id: values[3] as string,
          status: 'PENDING', created_at: new Date(), updated_at: new Date(),
        };
        approvals.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from approval_requests')) return { rows: approvals.filter(row => row.project_id === values[0]) };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const transaction = async (work: (client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
      work({ query: async (sql: string, values: unknown[] = []) => {
        if (sql.startsWith('select id from users')) return { rows: [{ id: values[0] }] };
        if (sql.startsWith('insert into auth_sessions')) { sessions.set(values[0] as string, values[1] as string); return { rows: [] }; }
        if (sql.startsWith('insert into refresh_tokens')) return { rows: [] };
        throw new Error(`Unexpected transaction SQL: ${sql}`);
      } });
    const db = { query, transaction } as unknown as DatabaseService;
    const auth = new AuthService(db);
    aliceAccess = (await auth.createSession(aliceId)).access;
    bobAccess = (await auth.createSession(bobId)).access;
    const module = await Test.createTestingModule({
      controllers: [SecurityPolicyController, ApprovalRequestController],
      providers: [
        ProjectAccessService, SecurityPolicyService, ApprovalRequestService,
        { provide: DatabaseService, useValue: db },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => { await app.close(); vi.unstubAllEnvs(); });

  it('returns the same 400/401/403/404 semantics for both resources and methods', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const resource of resources) {
      await withSession(request(server).get(path('bad-id', resource.segment)), aliceAccess).expect(400);
      await asWriter(request(server).post(path('bad-id', resource.segment)), aliceAccess).send(resource.body).expect(400);
      await request(server).get(path(projectA, resource.segment)).expect(401);
      await request(server).post(path(projectA, resource.segment)).send(resource.body).expect(401);
      await withSession(request(server).get(path(projectB, resource.segment)), aliceAccess).expect(403);
      await asWriter(request(server).post(path(projectB, resource.segment)), aliceAccess).send(resource.body).expect(403);
      await withSession(request(server).get(path(missingProject, resource.segment)), aliceAccess).expect(404);
      await asWriter(request(server).post(path(missingProject, resource.segment)), aliceAccess).send(resource.body).expect(404);
    }
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('security_policies') || String(sql).includes('approval_requests'))).toHaveLength(0);
  });

  it('rejects invalid and revoked sessions before resource access', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await withSession(request(server).get(path(projectA, 'security-policies')), 'invalid-token').expect(401);
    const sessionId = [...sessions.entries()].find(([, userId]) => userId === aliceId)?.[0];
    sessions.delete(sessionId!);
    await withSession(request(server).get(path(projectA, 'approval-requests')), aliceAccess).expect(401);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('from projects p'))).toHaveLength(0);
  });

  it('isolates policies and requests across member projects and blocks another member', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const resource of resources) {
      await asWriter(request(server).post(path(projectA, resource.segment)), aliceAccess).send(resource.body).expect(201);
      await asWriter(request(server).post(path(projectC, resource.segment)), aliceAccess).send(resource.body).expect(201);
      const a = await withSession(request(server).get(path(projectA, resource.segment)), aliceAccess).expect(200);
      const c = await withSession(request(server).get(path(projectC, resource.segment)), aliceAccess).expect(200);
      expect(a.body).toHaveLength(1);
      expect(c.body).toHaveLength(1);
      expect(a.body[0].projectId).toBe(projectA);
      expect(c.body[0].projectId).toBe(projectC);
      await withSession(request(server).get(path(projectA, resource.segment)), bobAccess).expect(403);
      await asWriter(request(server).post(path(projectA, resource.segment)), bobAccess).send(resource.body).expect(403);
    }
    expect(approvals.map(row => row.requested_by_id)).toEqual([aliceId, aliceId]);
    expect(approvals.map(row => row.status)).toEqual(['PENDING', 'PENDING']);
  });

  it('rejects unsafe DTO values and keeps every inserted value parameterized', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const policyPath = path(projectA, 'security-policies');
    const approvalPath = path(projectA, 'approval-requests');
    for (const body of [{ ...policy, name: '  ' }, { ...policy, blockCritical: 'true' }, { ...policy, blockHigh: 1 }]) {
      await asWriter(request(server).post(policyPath), aliceAccess).send(body).expect(400);
    }
    for (const body of [{ ...approval, title: '  ' }, { ...approval, status: 'APPROVED' }, { ...approval, requestedById: bobId }, { ...approval, userId: bobId }, { ...approval, approvedBy: bobId }, { ...approval, decision: 'APPROVED' }]) {
      await asWriter(request(server).post(approvalPath), aliceAccess).send(body).expect(400);
    }
    const marker = "value'); drop table projects; --";
    const createdPolicy = await asWriter(request(server).post(policyPath), aliceAccess).send({ ...policy, name: marker }).expect(201);
    const createdApproval = await asWriter(request(server).post(approvalPath), aliceAccess).send({ ...approval, title: marker }).expect(201);
    expect(createdPolicy.body.name).toBe(marker);
    expect(createdApproval.body).toMatchObject({ title: marker, requestedById: aliceId, status: 'PENDING' });
    const resourceCalls = query.mock.calls.filter(([sql]) => String(sql).includes('security_policies') || String(sql).includes('approval_requests'));
    expect(resourceCalls).toHaveLength(2);
    for (const [sql, values] of resourceCalls) {
      expect(String(sql)).not.toContain(marker);
      expect(String(sql)).toMatch(/\$1/);
      expect(values).toContain(marker);
      expect(values[0]).toBe(projectA);
    }
    expect(approvals[0].requested_by_id).toBe(aliceId);
    expect(approvals[0].status).toBe('PENDING');
  });

  it('requires the shared CSRF rule for either write route', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const resource of resources) {
      await withSession(request(server).post(path(projectA, resource.segment)), aliceAccess).send(resource.body).expect(403);
    }
    expect(policies).toHaveLength(0);
    expect(approvals).toHaveLength(0);
  });
});
