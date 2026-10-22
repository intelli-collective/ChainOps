import { requireEnv } from '../env.js';

export function authConfig() {
  const origin = new URL(requireEnv('AUTH_WEB_ORIGIN')).origin;
  const secret = requireEnv('AUTH_JWT_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('AUTH_JWT_SECRET requires at least 32 bytes');
  const secure = process.env.AUTH_COOKIE_SECURE !== 'false';
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE ?? 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite) || (sameSite === 'none' && !secure)) throw new Error('Invalid auth cookie configuration');
  if (process.env.NODE_ENV === 'production' && !secure) throw new Error('Production requires secure cookies');
  return { origin, secret: new TextEncoder().encode(secret), secure, sameSite: sameSite as 'lax' | 'strict' | 'none', issuer: 'chainops', audience: 'chainops-web' };
}
