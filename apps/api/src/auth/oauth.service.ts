import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DatabaseService } from '../database/database.service.js';
import { requireEnv } from '../env.js';
import { AuthService, digest, opaque } from './auth.service.js';

export type Provider = 'google' | 'github';
export function providerName(value: string): Provider {
  if (value !== 'google' && value !== 'github') throw new UnauthorizedException('Unsupported provider');
  return value;
}
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

@Injectable()
export class OAuthService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService, @Inject(AuthService) private readonly auth: AuthService) {}

  async start(provider: Provider, browser: string) {
    const prefix = provider.toUpperCase();
    const state = opaque(), verifier = opaque(), nonce = opaque();
    const client = requireEnv(`${prefix}_CLIENT_ID`);
    requireEnv(`${prefix}_CLIENT_SECRET`);
    const redirect = requireEnv(`${prefix}_CALLBACK_URL`);
    await this.db.query("insert into oauth_attempts values($1,$2,$3,$4,$5,now()+interval '10 minutes')", [digest(state),provider,verifier,nonce,digest(browser)]);
    const url = new URL(provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({ client_id: client, redirect_uri: redirect, response_type: 'code', scope: provider === 'google' ? 'openid email profile' : 'read:user user:email', state, code_challenge: Buffer.from(digest(verifier),'hex').toString('base64url'), code_challenge_method: 'S256', ...(provider === 'google' ? { nonce } : {}) }).toString();
    return url.toString();
  }

  async callback(provider: Provider, state: unknown, code: unknown, browser?: string) {
    if (typeof state !== 'string' || state.length !== 43 || typeof code !== 'string' || code.length > 2048 || !browser) throw new UnauthorizedException('Invalid OAuth callback');
    const { rows } = await this.db.query<{ verifier: string; nonce: string }>('delete from oauth_attempts where state_hash=$1 and provider=$2 and browser_hash=$3 and expires_at>now() returning verifier,nonce', [digest(state),provider,digest(browser)]);
    const attempt = rows[0];
    if (!attempt) throw new UnauthorizedException('OAuth attempt expired or invalid');
    const prefix = provider.toUpperCase();
    const tokens = await this.json(provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: requireEnv(`${prefix}_CLIENT_ID`), client_secret: requireEnv(`${prefix}_CLIENT_SECRET`), redirect_uri: requireEnv(`${prefix}_CALLBACK_URL`), grant_type: 'authorization_code', code, code_verifier: attempt.verifier }),
    });
    let subject: string, email: string, name: string;
    if (provider === 'google') {
      if (typeof tokens.id_token !== 'string') throw new UnauthorizedException();
      const { payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer: ['https://accounts.google.com','accounts.google.com'], audience: requireEnv('GOOGLE_CLIENT_ID'), algorithms: ['RS256'], maxTokenAge: '10m' });
      if (payload.nonce !== attempt.nonce || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) throw new UnauthorizedException();
      subject = payload.sub; email = payload.email; name = typeof payload.name === 'string' ? payload.name : email;
    } else {
      if (typeof tokens.access_token !== 'string') throw new UnauthorizedException();
      const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      const profile = await this.json('https://api.github.com/user', { headers });
      const response = await fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new UnauthorizedException();
      const emails: unknown = await response.json();
      const verified = Array.isArray(emails) ? emails.find((e: { verified?: boolean; primary?: boolean; email?: unknown }) => e.verified === true && e.primary === true && typeof e.email === 'string') as { email: string } | undefined : undefined;
      if (!verified || typeof profile.id !== 'number') throw new UnauthorizedException('Provider email must be verified');
      subject = String(profile.id); email = verified.email; name = typeof profile.name === 'string' ? profile.name : typeof profile.login === 'string' ? profile.login : 'ChainOps user';
    }
    if (email.length > 254) throw new UnauthorizedException();
    const userId = await this.auth.providerUser(provider,subject,email,name);
    return this.auth.createSession(userId);
  }

  private async json(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new UnauthorizedException('Provider request failed');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || 'error' in value) throw new UnauthorizedException('Provider request failed');
    return value as Record<string, unknown>;
  }
}
