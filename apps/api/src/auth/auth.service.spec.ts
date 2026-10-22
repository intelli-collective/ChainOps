import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthService, credentials, digest } from './auth.service.js';
import { authConfig } from './config.js';
import { DatabaseService } from '../database/database.service.js';
import { OAuthService } from './oauth.service.js';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('authentication validation', () => {
  it('normalizes emails and rejects invalid registration data', () => {
    expect(credentials({ email: ' USER@example.test ', password: 'long password value', fullName: ' Name ', acceptedTerms: true },true).email).toBe('user@example.test');
    for (const body of [null, {}, { email: 'bad', password: 'test' }, { email: 'a@b.test', password: 'short', fullName: 'Name', acceptedTerms: true }]) expect(() => credentials(body,true)).toThrow();
  });
  it('fails closed when email delivery is absent', async () => {
    vi.stubEnv('AUTH_SMTP_URL','');
    const service = new AuthService({} as DatabaseService);
    await expect(service.register({ email: 'user@example.test', password: 'long password value', fullName: 'Name', acceptedTerms: true })).rejects.toThrow('Email verification delivery is not configured');
  });
  it('requires strong signing configuration and secure production cookies', () => {
    vi.stubEnv('AUTH_WEB_ORIGIN','http://localhost:5173'); vi.stubEnv('AUTH_JWT_SECRET','weak');
    expect(() => authConfig()).toThrow();
    vi.stubEnv('AUTH_JWT_SECRET','x'.repeat(32)); vi.stubEnv('NODE_ENV','production'); vi.stubEnv('AUTH_COOKIE_SECURE','false');
    expect(() => authConfig()).toThrow('Production requires secure cookies');
  });
  it('rejects missing and malformed JWTs before querying the database', async () => {
    vi.stubEnv('AUTH_WEB_ORIGIN','http://localhost:5173'); vi.stubEnv('AUTH_JWT_SECRET','x'.repeat(32));
    const query = vi.fn(); const service = new AuthService({ query } as unknown as DatabaseService);
    await expect(service.authenticate()).rejects.toThrow(); await expect(service.authenticate('bad')).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
  });
  it('never stores opaque refresh values in SQL arguments', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const service = new AuthService({ query } as unknown as DatabaseService);
    await service.logout('secret-refresh'); expect(query.mock.calls[0][1]).toEqual([digest('secret-refresh')]);
  });
});

describe('OAuth failures', () => {
  it('rejects missing browser binding and mismatched or expired states before network calls', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] }); const fetchMock = vi.fn(); vi.stubGlobal('fetch',fetchMock);
    const oauth = new OAuthService({ query } as unknown as DatabaseService, {} as AuthService);
    await expect(oauth.callback('google','x'.repeat(43),'code')).rejects.toThrow();
    await expect(oauth.callback('github','x'.repeat(43),'code','browser')).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects provider exchange errors without creating a session', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID','test'); vi.stubEnv('GITHUB_CLIENT_SECRET','test'); vi.stubEnv('GITHUB_CALLBACK_URL','http://localhost:3000/auth/github/callback');
    const query = vi.fn().mockResolvedValue({ rows: [{ verifier: 'verifier', nonce: 'nonce' }] });
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'bad_verification_code' }))));
    const createSession = vi.fn(); const oauth = new OAuthService({ query } as unknown as DatabaseService, { createSession } as unknown as AuthService);
    await expect(oauth.callback('github','x'.repeat(43),'code','browser')).rejects.toThrow(); expect(createSession).not.toHaveBeenCalled();
  });
});
