import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthController } from './auth.controller.js';
import { OAuthController } from './oauth.controller.js';
import { AuthService } from './auth.service.js';
import { OAuthService } from './oauth.service.js';

describe('shared session cookie paths', () => {
  let app: INestApplication;
  beforeAll(async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('AUTH_JWT_SECRET', 'test-only-secret-'.repeat(4));
    vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
    const auth = {
      rateLimit: vi.fn(), login: vi.fn().mockResolvedValue({ access: 'access-value', refresh: 'refresh-value' }),
      current: vi.fn().mockResolvedValue({ user: { id: 'member' }, organizations: [], nextPath: '/projects' }),
      logout: vi.fn(),
    };
    const oauth = { callback: vi.fn().mockResolvedValue({ access: 'oauth-access', refresh: 'oauth-refresh' }) };
    const module = await Test.createTestingModule({
      controllers: [AuthController, OAuthController],
      providers: [{ provide: AuthService, useValue: auth }, { provide: OAuthService, useValue: oauth }],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });
  afterAll(async () => { await app.close(); vi.unstubAllEnvs(); });

  it('makes access and CSRF cookies available to project routes but keeps refresh scoped to auth', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const agent = request.agent(server);
    const csrf = await agent.get('/auth/csrf').expect(200);
    const csrfCookies = csrf.headers['set-cookie'] as unknown as string[];
    expect(csrfCookies.find(cookie => cookie.startsWith('chainops_csrf=') && !cookie.includes('Expires=Thu'))).toMatch(/Path=\/(?:;|$)/);
    const login = await agent.post('/auth/login').set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', csrf.body.csrfToken as string).send({}).expect(201);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(cookies.find(cookie => cookie.startsWith('chainops_access=access-value'))).toMatch(/Path=\/(?:;|$)/);
    expect(cookies.find(cookie => cookie.startsWith('chainops_refresh=refresh-value'))).toContain('Path=/auth');
    const logout = await agent.post('/auth/logout').set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', csrf.body.csrfToken as string).send({}).expect(201);
    const cleared = logout.headers['set-cookie'] as unknown as string[];
    expect(cleared.some(cookie => cookie.startsWith('chainops_access=;') && /Path=\/(?:;|$)/.test(cookie))).toBe(true);
    expect(cleared.some(cookie => cookie.startsWith('chainops_access=;') && cookie.includes('Path=/auth'))).toBe(true);
  });

  it('issues the same globally scoped access cookie after OAuth callback', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/auth/github/callback?state=state&code=code')
      .set('Cookie', 'chainops_oauth=browser').expect(302);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.find(cookie => cookie.startsWith('chainops_access=oauth-access'))).toMatch(/Path=\/(?:;|$)/);
    expect(cookies.find(cookie => cookie.startsWith('chainops_refresh=oauth-refresh'))).toContain('Path=/auth');
  });
});
