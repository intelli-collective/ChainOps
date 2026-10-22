import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ApprovalRequestController } from './approval-request.controller.js';
import { ApprovalRequestService } from './approval-request.service.js';
import type { ApprovalRequestRow } from './security-governance.types.js';

const projectA = randomUUID();
const projectB = randomUUID();
const memberId = randomUUID();
const outsiderId = randomUUID();
const csrf = 'c'.repeat(43);
const input = { title: 'Approve Vault v1.0 release', description: 'Requesting approval for testnet deployment' };

describe('approval request HTTP API', () => {
  let app: INestApplication;
  let rows: ApprovalRequestRow[];
  let query: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4));
    rows = [];
    query = vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('from projects p')) {
        if (values[0] !== projectA && values[0] !== projectB) return { rows: [] };
        return { rows: [{ id: values[0], member_user_id: values[1] === memberId ? memberId : null }] };
      }
      if (sql.includes('insert into approval_requests')) {
        const timestamp = new Date(Date.UTC(2026, 9, 22, 12, 0, rows.length));
        const row: ApprovalRequestRow = {
          id: randomUUID(), project_id: values[0] as string, title: values[1] as string,
          description: values[2] as string | null, requested_by_id: values[3] as string,
          status: 'PENDING', created_at: timestamp, updated_at: timestamp,
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from approval_requests')) {
        return { rows: rows.filter(row => row.project_id === values[0]).sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const auth = {
      authenticate: vi.fn(async (token?: string) => {
        if (token === 'member-session') return { user: { id: memberId } };
        if (token === 'outsider-session') return { user: { id: outsiderId } };
        throw new UnauthorizedException();
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [ApprovalRequestController],
      providers: [
        ProjectAccessService, ApprovalRequestService,
        { provide: DatabaseService, useValue: { query } },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => { await app.close(); vi.unstubAllEnvs(); });

  const path = (projectId: string) => `/projects/${projectId}/approval-requests`;
  const asMember = (req: request.Test) => req.set('Cookie', `chainops_access=member-session; chainops_csrf=${csrf}`);
  const asWriter = (req: request.Test) => asMember(req).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', csrf);

  it('creates with 201, authenticated requester, database-default PENDING, and lists newest first', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const first = await asWriter(request(server).post(path(projectA))).send(input).expect(201);
    const second = await asWriter(request(server).post(path(projectA))).send({ title: 'Review second release' }).expect(201);
    expect(first.body).toMatchObject({ projectId: projectA, title: input.title, description: input.description, requestedById: memberId, status: 'PENDING' });
    expect(first.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.body.createdAt).toEqual(expect.any(String));
    expect(second.body).toMatchObject({ description: null, requestedById: memberId, status: 'PENDING' });
    const listed = await asMember(request(server).get(path(projectA))).expect(200);
    expect(listed.body).toEqual([second.body, first.body]);
    const insertion = query.mock.calls.find(([sql]) => String(sql).includes('insert into approval_requests'));
    expect(insertion?.[1]).toEqual([projectA, input.title, input.description, memberId]);
    expect(String(insertion?.[0])).not.toMatch(/\bstatus\b/);
    expect(String(query.mock.calls.find(([sql]) => String(sql).includes('from approval_requests'))?.[0])).toContain('order by created_at desc, id desc');
  });

  it('rejects an empty title and invalid description', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asWriter(request(server).post(path(projectA))).send({ ...input, title: '   ' }).expect(400);
    await asWriter(request(server).post(path(projectA))).send({ ...input, description: 42 }).expect(400);
    expect(rows).toHaveLength(0);
  });

  it('rejects status, requester and decision fields rather than trusting client values', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const field of ['status', 'requestedById', 'requested_by_id', 'userId', 'approvedBy', 'approvedById', 'decision', 'approvedAt', 'rejectedAt']) {
      await asWriter(request(server).post(path(projectA))).send({ ...input, [field]: field === 'status' ? 'APPROVED' : outsiderId }).expect(400);
    }
    expect(rows).toHaveLength(0);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into approval_requests'))).toBe(false);
  });

  it('lists only records in the requested project', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asWriter(request(server).post(path(projectA))).send(input).expect(201);
    await asWriter(request(server).post(path(projectB))).send({ title: 'Project B request' }).expect(201);
    const a = await asMember(request(server).get(path(projectA))).expect(200);
    const b = await asMember(request(server).get(path(projectB))).expect(200);
    expect(a.body).toHaveLength(1);
    expect(b.body).toHaveLength(1);
    expect(a.body[0].title).toBe(input.title);
    expect(b.body[0].title).toBe('Project B request');
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('from approval_requests')).map(([, values]) => values)).toEqual([[projectA], [projectB]]);
  });

  it('requires a valid project, live session, membership and CSRF for writes', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asMember(request(server).get(path('not-a-uuid'))).expect(400);
    await request(server).get(path(projectA)).expect(401);
    await request(server).post(path(projectA)).send(input).expect(401);
    await request(server).get(path(projectA)).set('Cookie', 'chainops_access=outsider-session').expect(403);
    await request(server).post(path(projectA)).set('Cookie', 'chainops_access=outsider-session').send(input).expect(403);
    await asMember(request(server).get(path(randomUUID()))).expect(404);
    await asMember(request(server).post(path(projectA))).send(input).expect(403);
    expect(rows).toHaveLength(0);
  });
});
