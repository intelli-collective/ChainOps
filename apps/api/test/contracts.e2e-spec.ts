import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { SignJWT } from 'jose';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { authConfig } from '../src/auth/config.js';
import { ContractsController } from '../src/contracts/contracts.controller.js';
import { ContractsGuard } from '../src/contracts/contracts.guard.js';
import { ContractsService } from '../src/contracts/contracts.service.js';

// Explicit test DB opt-in. All DDL and fixtures roll back in one transaction.
describe.skipIf(!process.env.CONTRACTS_TEST_DATABASE_URL)(
  'artifact PostgreSQL integration',
  () => {
    let client: pg.Client;
    let app: INestApplication;
    beforeAll(async () => {
      vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
      vi.stubEnv('AUTH_JWT_SECRET', 'contracts-test-only-secret-'.repeat(3));
      client = new pg.Client({
        connectionString: process.env.CONTRACTS_TEST_DATABASE_URL,
      });
      await client.connect();
      await client.query('begin');
      const schema = `contracts_test_${randomUUID().replaceAll('-', '')}`;
      await client.query(`create schema "${schema}"`);
      await client.query(`set local search_path to "${schema}"`);
      for (const name of [
        '001_core_schema.sql',
        '002_authentication.sql',
        '003_password_resets.sql',
        '004_contract_artifacts.sql',
        '004_contract_artifacts.sql',
      ]) {
        await client.query(
          await readFile(
            new URL(`../migrations/${name}`, import.meta.url),
            'utf8',
          ),
        );
      }
      const module = await Test.createTestingModule({
        controllers: [ContractsController],
        providers: [
          ContractsService,
          ContractsGuard,
          AuthService,
          {
            provide: DatabaseService,
            useValue: {
              query: (sql: string, args?: unknown[]) => client.query(sql, args),
            },
          },
        ],
      }).compile();
      app = module.createNestApplication();
      await app.init();
    }, 60000);
    afterAll(async () => {
      await app?.close();
      if (client) {
        await client.query('rollback');
        await client.end();
      }
      vi.unstubAllEnvs();
    });
    it('persists POST -> list -> detail, enforces real sessions, membership, uniqueness and project isolation', async () => {
      const user = (
        await client.query(
          "insert into users(full_name,email) values('Artifact tester','artifact@example.test') returning id",
        )
      ).rows[0].id as string;
      const org = (
        await client.query(
          "insert into organizations(name,slug,created_by_id) values('Artifacts','artifacts',$1) returning id",
          [user],
        )
      ).rows[0].id as string;
      await client.query(
        'insert into organization_members(organization_id,user_id) values($1,$2)',
        [org, user],
      );
      const projects: string[] = [];
      for (const slug of ['first', 'second'])
        projects.push(
          (
            await client.query(
              'insert into projects(organization_id,name,slug,created_by_id) values($1,$2,$2,$3) returning id',
              [org, slug, user],
            )
          ).rows[0].id as string,
        );
      const session = (
        await client.query(
          "insert into auth_sessions(user_id,expires_at) values($1,now()+interval '1 hour') returning id",
          [user],
        )
      ).rows[0].id as string;
      const config = authConfig();
      const token = await new SignJWT({ sid: session })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setExpirationTime('5m')
        .sign(config.secret);
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const base = `/projects/${projects[0]}/contracts`;
      const get = (url: string) =>
        request(server).get(url).set('Authorization', `Bearer ${token}`);
      const input = {
        name: 'Vault',
        version: '1.0.0',
        framework: 'hardhat',
        contractPath: 'contracts/Vault.sol',
        compilerVersion: '0.8.24',
      };
      await request(server).get(base).expect(401);
      await request(server)
        .get(base)
        .set('Authorization', 'Bearer tampered')
        .expect(401);
      const created = await request(server)
        .post(base)
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(201);
      expect((await get(base).expect(200)).body).toEqual([created.body]);
      expect(
        (await get(`${base}/${created.body.id}`).expect(200)).body,
      ).toEqual(created.body);
      expect(
        (
          await client.query(
            'select name,project_id from contract_artifacts where id=$1',
            [created.body.id],
          )
        ).rows[0],
      ).toEqual({ name: 'Vault', project_id: projects[0] });
      await get(`/projects/${projects[1]}/contracts/${created.body.id}`).expect(
        404,
      );
      await get(`${base}/${randomUUID()}`).expect(404);
      await get(`/projects/${randomUUID()}/contracts`).expect(404);
      // A savepoint keeps the outer rollback fixture usable after the unique violation.
      await client.query('savepoint duplicate_test');
      await request(server)
        .post(base)
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(409);
      await client.query('rollback to savepoint duplicate_test');
      // The uniqueness boundary is the project, not the organization or global name.
      await request(server)
        .post(`/projects/${projects[1]}/contracts`)
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(201);
      expect((await get(base).expect(200)).body).toHaveLength(1);
      await client.query(
        'update contract_artifacts set created_at=$1 where project_id=$2',
        [created.body.createdAt, projects[0]],
      );
      const next = await request(server)
        .post(base)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...input, version: '2.0.0' })
        .expect(201);
      await client.query(
        'update contract_artifacts set created_at=$1 where id=$2',
        [created.body.createdAt, next.body.id],
      );
      const ordered = (await get(base).expect(200)).body as { id: string }[];
      expect(ordered.map((a) => a.id)).toEqual(
        [created.body.id, next.body.id].sort((a: string, b: string) =>
          a.localeCompare(b),
        ),
      );
      await request(server)
        .post(base)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...input, name: '' })
        .expect(400);
      await client.query(
        'delete from organization_members where organization_id=$1 and user_id=$2',
        [org, user],
      );
      await get(base).expect(403);
      await get(`${base}/${created.body.id}`).expect(403);
      await request(server)
        .post(base)
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(403);
      await client.query(
        'update auth_sessions set revoked_at=now() where id=$1',
        [session],
      );
      await get(base).expect(401);
    });
  },
);
