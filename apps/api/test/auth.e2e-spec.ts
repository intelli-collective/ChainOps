import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import * as argon2 from 'argon2';
import { SignJWT } from 'jose';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthService, digest, opaque } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { OAuthService } from '../src/auth/oauth.service.js';
import { authConfig } from '../src/auth/config.js';

// Explicit opt-in only. Every table lives in a uniquely named test schema.
describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)('authentication PostgreSQL integration', () => {
  let pool: pg.Pool, admin: pg.Client, db: DatabaseService, auth: AuthService, app: INestApplication;
  const schema = `auth_test_${randomUUID().replaceAll('-','')}`;
  let delivered = '';
  beforeAll(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN','http://localhost:5173'); vi.stubEnv('AUTH_JWT_SECRET','test-only-secret-'.repeat(4)); vi.stubEnv('AUTH_COOKIE_SECURE','false');
    vi.stubEnv('AUTH_SMTP_URL','smtp://localhost:2525'); vi.stubEnv('AUTH_EMAIL_FROM','test@example.test');
    vi.spyOn(nodemailer,'createTransport').mockReturnValue({ sendMail: async (mail: { text: string }) => { delivered = mail.text; return {}; } } as unknown as ReturnType<typeof nodemailer.createTransport>);
    admin = new pg.Client({ connectionString: process.env.AUTH_TEST_DATABASE_URL }); await admin.connect();
    await admin.query(`create schema "${schema}"`);
    pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    for (const name of ['001_core_schema.sql','002_authentication.sql']) await pool.query(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
    db = { query: (sql: string, args?: unknown[]) => pool.query(sql,args), transaction: async (work: (c: pg.PoolClient) => Promise<unknown>) => {
      const c = await pool.connect(); try { await c.query('begin'); const value = await work(c); await c.query('commit'); return value; } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    } } as DatabaseService;
    auth = new AuthService(db);
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: auth }, { provide: OAuthService, useValue: new OAuthService(db,auth) }] }).compile();
    app = module.createNestApplication(); app.use(cookieParser()); await app.init();
  },60000);
  afterAll(async () => {
    await app?.close(); await pool?.end();
    if (admin) { await admin.query(`drop schema if exists "${schema}" cascade`); await admin.end(); }
    vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
  const input = { email: 'member@example.test', fullName: 'Member', password: 'long test password', acceptedTerms: true };
  let access: string, refresh: string;
  it('registers a user without creating an organization and stores only password/token hashes', async () => {
    await expect(auth.register(input)).resolves.toMatchObject({ verificationRequired: true });
    const user = (await pool.query('select * from users')).rows[0];
    const credential = (await pool.query('select * from password_credentials')).rows[0];
    expect(credential.password_hash).toMatch(/^\$argon2id\$/); expect(await argon2.verify(credential.password_hash,input.password)).toBe(true);
    expect(user.password_hash).toBeNull(); expect(user.email_verified_at).toBeNull(); expect((await pool.query('select * from organizations')).rowCount).toBe(0);
    expect((await pool.query('select * from email_verifications')).rows[0].token_hash).not.toBe(delivered.split('token=')[1]);
    await expect(auth.login(input)).rejects.toThrow('Verify your email');
  });
  it('uses single-use expiring email verification and prevents duplicate accounts', async () => {
    await auth.register(input); expect((await pool.query('select * from users')).rowCount).toBe(1);
    const token = delivered.split('token=')[1]; await auth.verifyEmail(token);
    await expect(auth.verifyEmail(token)).rejects.toThrow();
    const expired = opaque(); const user = (await pool.query('select id from users')).rows[0];
    await pool.query("insert into email_verifications values($1,$2,now()-interval '1 second')",[digest(expired),user.id]);
    await expect(auth.verifyEmail(expired)).rejects.toThrow();
  });
  it('rejects invalid credentials and creates revocable JWT/opaque sessions after verified login', async () => {
    await expect(auth.login({ ...input,password:'incorrect' })).rejects.toThrow('Invalid email or password');
    const tokens = await auth.login(input); access=tokens.access; refresh=tokens.refresh;
    expect(await auth.current(access)).toMatchObject({ user: { email: input.email }, nextPath: '/onboarding' });
    expect((await pool.query('select token_hash from refresh_tokens')).rows[0].token_hash).toBe(digest(refresh));
    await expect(auth.authenticate('tampered')).rejects.toThrow();
    const c=authConfig(); const expired=await new SignJWT({ sid: randomUUID() }).setProtectedHeader({alg:'HS256'}).setIssuer(c.issuer).setAudience(c.audience).setSubject(randomUUID()).setExpirationTime(1).sign(c.secret);
    await expect(auth.authenticate(expired)).rejects.toThrow();
  });
  it('rotates refresh tokens and commits revocation on reuse', async () => {
    const rotated=await auth.refresh(refresh); expect(rotated.refresh).not.toBe(refresh);
    await expect(auth.refresh(refresh)).rejects.toThrow();
    await expect(auth.authenticate(rotated.access)).rejects.toThrow();
    await expect(auth.refresh(rotated.refresh)).rejects.toThrow();
  });
  it('serializes concurrent refresh attempts and revokes a replayed session', async () => {
    const tokens = await auth.login(input);
    const results = await Promise.allSettled([auth.refresh(tokens.refresh),auth.refresh(tokens.refresh)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const success = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ access: string; refresh: string }>;
    await expect(auth.authenticate(success.value.access)).rejects.toThrow();
  });
  it('returns safe credential errors for unknown accounts and invalid seed hashes', async () => {
    await expect(auth.login({email:'unknown@example.test',password:'incorrect'})).rejects.toThrow('Invalid email or password');
    const user = (await pool.query("insert into users(full_name,email,email_verified_at) values('Seed','seed@example.test',now()) returning id")).rows[0];
    await pool.query("insert into password_credentials values($1,'not-a-password-hash')",[user.id]);
    await expect(auth.login({email:'seed@example.test',password:'incorrect'})).rejects.toThrow('Invalid email or password');
  });
  it('revokes logout and all-session tokens immediately and rejects expired sessions', async () => {
    const first=await auth.login(input); await auth.logout(first.refresh);
    await expect(auth.authenticate(first.access)).rejects.toThrow(); await expect(auth.refresh(first.refresh)).rejects.toThrow();
    const second=await auth.login(input), third=await auth.login(input); await auth.revokeAll(second.access);
    await expect(auth.authenticate(third.access)).rejects.toThrow();
    const expired=await auth.login(input); await pool.query("update auth_sessions set expires_at=now()-interval '1 second' where revoked_at is null");
    await expect(auth.refresh(expired.refresh)).rejects.toThrow();
  });
  it('does not merge matching provider emails and enforces identity uniqueness', async () => {
    await expect(auth.providerUser('github','123',input.email,'Member')).rejects.toThrow('Account identity already exists');
    const id=await auth.providerUser('github','123','github@example.test','GitHub member');
    expect(await auth.providerUser('github','123','changed@example.test','Changed')).toBe(id);
    await expect(pool.query("insert into auth_identities(user_id,provider,subject) values($1,'github','123')",[id])).rejects.toMatchObject({code:'23505'});
  });
  it('sends returning members to projects without creating organizations during login', async () => {
    const user=(await pool.query('select id from users where email=$1',[input.email])).rows[0];
    const org=(await pool.query("insert into organizations(name,slug,created_by_id) values('Existing','existing',$1) returning id",[user.id])).rows[0];
    await pool.query('insert into organization_members(organization_id,user_id) values($1,$2)',[org.id,user.id]);
    const tokens=await auth.login(input); expect((await auth.current(tokens.access)).nextPath).toBe('/projects'); expect((await pool.query('select * from organizations')).rowCount).toBe(1);
  });
  it('protects HTTP endpoints, enforces CSRF and issues HttpOnly cookies', async () => {
    const server=app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/auth/me').expect(401);
    await request(server).post('/auth/login').send(input).expect(403);
    const agent=request.agent(server); const csrf=await agent.get('/auth/csrf').expect(200);
    const login=await agent.post('/auth/login').set('Origin','http://localhost:5173').set('X-CSRF-Token',csrf.body.csrfToken as string).send(input).expect(201);
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');
    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').set('Origin','http://localhost:5173').set('X-CSRF-Token',csrf.body.csrfToken as string).send({}).expect(201);
    await agent.get('/auth/me').expect(401);
  });
  it('shares rate limiting through PostgreSQL', async () => {
    for(let n=0;n<20;n++) await auth.rateLimit('test-ip','login');
    await expect(auth.rateLimit('test-ip','login')).rejects.toThrow('Too many attempts');
  });
});
