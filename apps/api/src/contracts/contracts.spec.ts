import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ContractsController } from './contracts.controller.js';
import { ContractsService } from './contracts.service.js';
import { ContractsGuard } from './contracts.guard.js';
import { parseArtifact } from './create-artifact.js';

const project = '11111111-1111-4111-8111-111111111111';
const contract = '22222222-2222-4222-8222-222222222222';
const user = '33333333-3333-4333-8333-333333333333';
const input = {
  name: 'Vault',
  version: '1.0.0',
  framework: 'hardhat',
  contractPath: 'contracts/Vault.sol',
  compilerVersion: '0.8.24',
};
const row = {
  id: contract,
  project_id: project,
  ...input,
  contract_path: input.contractPath,
  compiler_version: input.compilerVersion,
  created_at: new Date('2026-10-22T00:00:00Z'),
  updated_at: new Date('2026-10-22T00:00:00Z'),
};

describe('artifact metadata validation', () => {
  it.each([
    null,
    [],
    {},
    { ...input, name: ' ' },
    { ...input, version: 1 },
    { ...input, framework: 'unknown' },
    { ...input, contractPath: 'x'.repeat(513) },
    { ...input, name: 'a\u0000b' },
    { ...input, userId: user },
    { ...input, status: 'DEPLOYED' },
  ])('rejects invalid metadata %j', (value) => {
    expect(() => parseArtifact(value)).toThrow();
  });
  it('trims metadata and allows supported frameworks', () => {
    expect(
      parseArtifact({ ...input, name: ' Vault ', framework: 'foundry' }),
    ).toEqual({ ...input, name: 'Vault', framework: 'foundry' });
  });
});

describe('artifact HTTP routes (test-only auth and DB fixtures)', () => {
  let app: INestApplication;
  const query = vi.fn();
  const authenticate = vi.fn();
  const url = `/projects/${project}/contracts`;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        ContractsService,
        ContractsGuard,
        { provide: DatabaseService, useValue: { query } },
        { provide: AuthService, useValue: { authenticate } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    query.mockReset();
    authenticate.mockReset();
    authenticate.mockImplementation((token: string) => {
      if (token !== 'test-only-session') throw new UnauthorizedException();
      return { user: { id: user } };
    });
    query.mockResolvedValueOnce({ rows: [{ member: true }] });
  });
  const get = (path = url) =>
    request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(path)
      .set('Authorization', 'Bearer test-only-session');
  const post = (body: unknown = input) =>
    request(app.getHttpServer() as Parameters<typeof request>[0])
      .post(url)
      .set('Authorization', 'Bearer test-only-session')
      .send(body as object);

  it('POST -> list -> detail serializes metadata and ISO timestamps', async () => {
    query.mockResolvedValueOnce({ rows: [row] });
    const created = await post().expect(201);
    expect(created.body).toEqual({
      id: contract,
      projectId: project,
      ...input,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
    expect(query.mock.calls[1][1]).toEqual([
      project,
      user,
      'Vault',
      '1.0.0',
      'hardhat',
      'contracts/Vault.sol',
      '0.8.24',
    ]);
    query
      .mockResolvedValueOnce({ rows: [{ member: true }] })
      .mockResolvedValueOnce({ rows: [row] });
    expect((await get().expect(200)).body).toEqual([created.body]);
    expect(query.mock.calls[3][0]).toContain(
      'order by a.created_at asc,a.id asc',
    );
    query
      .mockResolvedValueOnce({ rows: [{ member: true }] })
      .mockResolvedValueOnce({ rows: [row] });
    expect((await get(`${url}/${contract}`).expect(200)).body).toEqual(
      created.body,
    );
    expect(query.mock.calls[5][1]).toEqual([project, user, contract]);
  });
  it('returns 409 only for the artifact uniqueness constraint', async () => {
    query.mockRejectedValueOnce({
      code: '23505',
      constraint: 'contract_artifacts_project_name_version_key',
    });
    await post().expect(409);
  });
  it('returns 400 for invalid metadata without inserting', async () => {
    await post({ ...input, userId: user }).expect(400);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each(['', 'Basic nope', 'Bearer invalid', 'Bearer a b'])(
    'fails closed for credentials %j',
    async (authorization) => {
      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get(url)
        .set('Authorization', authorization)
        .expect(401);
      expect(query).not.toHaveBeenCalled();
    },
  );
  it.each(['get', 'post', 'detail'])(
    'denies nonmembers for %s',
    async (method) => {
      query.mockReset().mockResolvedValueOnce({ rows: [{ member: false }] });
      if (method === 'post') await post().expect(403);
      else
        await get(method === 'detail' ? `${url}/${contract}` : url).expect(403);
      expect(query).toHaveBeenCalledTimes(1);
    },
  );
  it('returns 404 for a missing project', async () => {
    query.mockReset().mockResolvedValueOnce({ rows: [] });
    await get().expect(404);
  });
  it('returns 404 for an absent or other-project artifact', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await get(`${url}/${contract}`).expect(404);
    expect(query.mock.calls[1][0]).toContain('a.project_id=$1 and a.id=$3');
  });
  it('validates route UUIDs before querying', async () => {
    await get('/projects/not-a-uuid/contracts').expect(400);
    await get(`${url}/not-a-uuid`).expect(400);
    expect(query).not.toHaveBeenCalled();
  });
  it('returns an empty list', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect((await get().expect(200)).body).toEqual([]);
  });
  it('rechecks membership in the write statement', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await post().expect(403);
  });
});
