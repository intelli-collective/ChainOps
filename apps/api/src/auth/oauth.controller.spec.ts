import 'reflect-metadata';
import { afterEach, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { OAuthController } from './oauth.controller.js';
import type { OAuthService } from './oauth.service.js';
import type { AuthService } from './auth.service.js';

afterEach(() => vi.unstubAllEnvs());

it('redirects denied consent without establishing a session or leaking provider errors', async () => {
  vi.stubEnv('AUTH_WEB_ORIGIN','http://localhost:5173');
  vi.stubEnv('AUTH_JWT_SECRET','test-secret-'.repeat(4));
  const callback = vi.fn().mockRejectedValue(new Error('provider detail'));
  const current = vi.fn();
  const controller = new OAuthController({current} as unknown as AuthService, {callback} as unknown as OAuthService);
  const res = {clearCookie:vi.fn(),cookie:vi.fn(),redirect:vi.fn()};
  await controller.callback('github',{error:'access_denied',state:'s'.repeat(43)},{cookies:{chainops_oauth:'browser'}} as unknown as Request,res as unknown as Response);
  expect(res.clearCookie).toHaveBeenCalled();
  expect(res.cookie).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();
  expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/login?error=provider_failed');
});
