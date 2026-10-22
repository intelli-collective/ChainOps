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
import { SecurityPolicyController } from './security-policy.controller.js';
import { SecurityPolicyService } from './security-policy.service.js';
import type { SecurityPolicyRow } from './security-governance.types.js';

const projectA = randomUUID();
const projectB = randomUUID();
const userId = randomUUID();
const otherUserId = randomUUID();
const csrf = 'x'.repeat(43);

describe('security policy HTTP API', () => {
  let app: INestApplication;
  let rows: SecurityPolicyRow[];
  let query: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4));
    rows = [];
    query = vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('from projects p')) {
        if (values[0] !== projectA && values[0] !== projectB) return { rows: [] };
        return { rows: [{ id: values[0], member_user_id: values[1] === userId ? userId : null }] };
      }
      if (sql.includes('insert into security_policies')) {
        const row: SecurityPolicyRow = {
          id: randomUUID(), project_id: values[0] as string, name: values[1] as string,
          block_critical: values[2] as boolean, block_high: values[3] as boolean,
          require_approval: values[4] as boolean, created_at: new Date(), updated_at: new Date(),
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from security_policies')) {
        return { rows: rows.filter(row => row.project_id === values[0]).sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const auth = {
      authenticate: vi.fn(async (token?: string) => {
        if (token === 'member-session') return { user: { id: userId } };
        if (token === 'other-session') return { user: { id: otherUserId } };
        throw new UnauthorizedException();
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [SecurityPolicyController],
      providers: [
        ProjectAccessService, SecurityPolicyService,
        { provide: DatabaseService, useValue: { query } },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => { await app.close(); vi.unstubAllEnvs(); });

  const path = (projectId: string) => `/projects/${projectId}/security-policies`;
  const body = { name: 'Production Release Gate', blockCritical: true, blockHigh: true, requireApproval: true };
  const asMember = (req: request.Test) => req.set('Cookie', `chainops_access=member-session; chainops_csrf=${csrf}`);
  const asWriter = (req: request.Test) => asMember(req).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', csrf);

  it('creates a policy with 201 and lists the persisted project rows', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const created = await asWriter(request(server).post(path(projectA))).send(body).expect(201);
    expect(created.body).toMatchObject({ projectId: projectA, name: body.name, blockCritical: true, blockHigh: true, requireApproval: true });
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.body.createdAt).toEqual(expect.any(String));
    const listed = await asMember(request(server).get(path(projectA))).expect(200);
    expect(listed.body).toEqual([created.body]);
    expect(query.mock.calls.find(([sql]) => String(sql).includes('insert into security_policies'))?.[1]).toEqual([projectA, body.name, true, true, true]);
    expect(String(query.mock.calls.find(([sql]) => String(sql).includes('from security_policies'))?.[0])).toContain('order by created_at desc, id desc');
  });

  it('rejects empty names, non-boolean flags and unrecognized fields', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const invalid of [{ ...body, name: '   ' }, { ...body, blockHigh: 'true' }, { ...body, status: 'PASSED' }]) {
      await asWriter(request(server).post(path(projectA))).send(invalid).expect(400);
    }
    expect(rows).toHaveLength(0);
  });

  it('keeps listing and creation scoped to the requested project', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asWriter(request(server).post(path(projectA))).send(body).expect(201);
    await asWriter(request(server).post(path(projectB))).send({ ...body, name: 'Other project policy' }).expect(201);
    const a = await asMember(request(server).get(path(projectA))).expect(200);
    const b = await asMember(request(server).get(path(projectB))).expect(200);
    expect(a.body).toHaveLength(1);
    expect(b.body).toHaveLength(1);
    expect(a.body[0].name).toBe(body.name);
    expect(b.body[0].name).toBe('Other project policy');
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('from security_policies')).map(([, values]) => values)).toEqual([[projectA], [projectB]]);
  });

  it('rejects an invalid project ID and never queries the database for it', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asMember(request(server).get(path('not-a-uuid'))).expect(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('requires a live session and project membership before policy access', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get(path(projectA)).expect(401);
    await request(server).get(path(projectA)).set('Cookie', 'chainops_access=other-session').expect(403);
    await asMember(request(server).get(path(randomUUID()))).expect(404);
    expect(rows).toHaveLength(0);
  });

  it('requires the existing origin-bound CSRF token for writes', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await asMember(request(server).post(path(projectA))).send(body).expect(403);
    await asMember(request(server).post(path(projectA))).set('Origin', 'https://other.example').set('X-CSRF-Token', csrf).send(body).expect(403);
    expect(rows).toHaveLength(0);
  });
});
