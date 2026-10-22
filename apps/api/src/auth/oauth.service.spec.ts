import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthService } from './oauth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AuthService, digest } from './auth.service.js';
import { jwtVerify } from 'jose';
vi.mock('jose', async importOriginal => ({ ...await importOriginal<typeof import('jose')>(), jwtVerify: vi.fn() }));
const state = 's'.repeat(43);
function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [{ verifier: 'verifier', nonce: 'nonce' }] });
  const providerUser = vi.fn().mockResolvedValue('user-id'), createSession = vi.fn().mockResolvedValue({ access: 'access', refresh: 'refresh' });
  const oauth = new OAuthService({ query } as unknown as DatabaseService, { providerUser, createSession } as unknown as AuthService);
  return { query, providerUser, createSession, oauth };
}
beforeEach(() => {
  for (const provider of ['GOOGLE','GITHUB']) {
    vi.stubEnv(`${provider}_CLIENT_ID`,'test-client'); vi.stubEnv(`${provider}_CLIENT_SECRET`,'test-secret'); vi.stubEnv(`${provider}_CALLBACK_URL`,`http://localhost:3000/auth/${provider.toLowerCase()}/callback`);
  }
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('provider protocol validation with mocked external responses', () => {
  it('uses PKCE for both providers and a Google nonce', async () => {
    const { oauth, query } = setup();
    for (const provider of ['google','github'] as const) {
      const url = new URL(await oauth.start(provider,'browser'));
      expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.searchParams.get('code_challenge')).toHaveLength(43);
      expect(query.mock.calls.at(-1)?.[1][4]).toBe(digest('browser'));
      if(provider==='google') expect(url.searchParams.get('nonce')).toHaveLength(43);
    }
  });
  it('validates Google audience, issuer, algorithm, nonce and verified email', async () => {
    const { oauth, providerUser } = setup();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ id_token:'signed-id-token' }))));
    vi.mocked(jwtVerify).mockResolvedValue({ payload:{ sub:'google-sub',email:'google@example.test',email_verified:true,nonce:'nonce',name:'Google member' },protectedHeader:{alg:'RS256'} } as Awaited<ReturnType<typeof jwtVerify>>);
    await expect(oauth.callback('google',state,'code','browser')).resolves.toEqual({access:'access',refresh:'refresh'});
    expect(jwtVerify).toHaveBeenCalledWith('signed-id-token',expect.any(Function),expect.objectContaining({audience:'test-client',algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com']}));
    expect(providerUser).toHaveBeenCalledWith('google','google-sub','google@example.test','Google member');
  });
  it.each([{ nonce:'wrong',email_verified:true },{ nonce:'nonce',email_verified:false }])('rejects invalid Google claims %j', async claims => {
    const { oauth, providerUser }=setup(); vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({id_token:'id-token'}))));
    vi.mocked(jwtVerify).mockResolvedValue({payload:{sub:'sub',email:'google@example.test',...claims},protectedHeader:{alg:'RS256'}} as Awaited<ReturnType<typeof jwtVerify>>);
    await expect(oauth.callback('google',state,'code','browser')).rejects.toThrow(); expect(providerUser).not.toHaveBeenCalled();
  });
  it('rejects Google signature verification failure', async () => {
    const { oauth, createSession }=setup(); vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({id_token:'invalid'}))));
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid signature'));
    await expect(oauth.callback('google',state,'code','browser')).rejects.toThrow(); expect(createSession).not.toHaveBeenCalled();
  });
  it('retrieves verified GitHub email and discards provider access tokens after sign-in', async () => {
    const { oauth, providerUser }=setup();
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'provider-token'}))).mockResolvedValueOnce(new Response(JSON.stringify({id:123,login:'octocat'}))).mockResolvedValueOnce(new Response(JSON.stringify([{email:'github@example.test',verified:true,primary:true}])));
    vi.stubGlobal('fetch',fetchMock);
    await oauth.callback('github',state,'code','browser'); expect(providerUser).toHaveBeenCalledWith('github','123','github@example.test','octocat');
    const exchange=fetchMock.mock.calls[0][1] as RequestInit; expect((exchange.body as URLSearchParams).get('code_verifier')).toBe('verifier');
  });
  it('rejects GitHub unverified emails', async () => {
    const { oauth, providerUser }=setup(); vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'provider-token'}))).mockResolvedValueOnce(new Response(JSON.stringify({id:123}))).mockResolvedValueOnce(new Response(JSON.stringify([{email:'github@example.test',verified:false,primary:true}]))));
    await expect(oauth.callback('github',state,'code','browser')).rejects.toThrow(); expect(providerUser).not.toHaveBeenCalled();
  });
});
