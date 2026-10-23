import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException, HttpException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import nodemailer from 'nodemailer';
import { DatabaseService } from '../database/database.service.js';
import { authConfig } from './config.js';

export const opaque = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type User = { id: string; email: string; full_name: string; email_verified_at: Date | null };
export function validateNewPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
  if (password.length > 128) throw new BadRequestException('Password must be at most 128 characters.');
}
export function credentials(body: unknown, registration = false) {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.email !== 'string' || typeof b.password !== 'string') throw new BadRequestException('Email and password are required');
  const email = b.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || b.password.length > 128 || !b.password.length) throw new BadRequestException('Invalid email or password');
  validateNewPassword(b.password);
  if (registration) {
    if (typeof b.fullName !== 'string' || !b.fullName.trim() || b.fullName.trim().length > 120 || b.acceptedTerms !== true) throw new BadRequestException('Provide a name and accept the terms.');
  }
  return { email, password: b.password, fullName: typeof b.fullName === 'string' ? b.fullName.trim() : '' };
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async rateLimit(ip: string, action: string) {
    const key = digest(`${action}:${ip}`);
    const { rows } = await this.db.query<{ attempts: number }>(`insert into auth_rate_limits(key,attempts,expires_at) values($1,1,now()+interval '15 minutes')
      on conflict(key) do update set attempts=case when auth_rate_limits.expires_at<now() then 1 else auth_rate_limits.attempts+1 end,
      expires_at=case when auth_rate_limits.expires_at<now() then now()+interval '15 minutes' else auth_rate_limits.expires_at end returning attempts`, [key]);
    if (rows[0].attempts > 20) throw new HttpException('Too many attempts; try again later', 429);
  }

  async register(body: unknown) {
    const input = credentials(body, true);
    if (!process.env.AUTH_SMTP_URL || !process.env.AUTH_EMAIL_FROM) throw new ServiceUnavailableException('Email verification delivery is not configured');
    const hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const token = opaque();
    try {
      await this.db.transaction(async c => {
        const { rows } = await c.query<User>('insert into users(full_name,email) values($1,$2) returning *', [input.fullName, input.email]);
        const id = rows[0].id;
        await c.query('insert into password_credentials values($1,$2)', [id, hash]);
        await c.query("insert into auth_identities(user_id,provider,subject) values($1::uuid,'local',$1::uuid::text)", [id]);
        await c.query("insert into email_verifications values($1,$2,now()+interval '30 minutes')", [digest(token), id]);
      });
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error;
      throw new ConflictException('An account with this email already exists.');
    }
    await this.deliver(input.email, token);
    return { verificationRequired: true, message: 'Check your email to verify ownership before signing in.' };
  }

  private async deliver(email: string, token: string) {
    try {
      await nodemailer.createTransport(process.env.AUTH_SMTP_URL!).sendMail({ from: process.env.AUTH_EMAIL_FROM, to: email, subject: 'Verify your ChainOps email', text: `Verify your email within 30 minutes: ${authConfig().origin}/verify-email#token=${token}` });
    } catch { throw new ServiceUnavailableException('Verification email could not be delivered. Request a new verification email.'); }
  }

  async resend(body: unknown) {
    if (!process.env.AUTH_SMTP_URL || !process.env.AUTH_EMAIL_FROM) throw new ServiceUnavailableException('Email verification delivery is not configured');
    const email = (body as { email?: unknown })?.email;
    if (typeof email !== 'string' || email.length > 254) throw new BadRequestException('Invalid email');
    const { rows } = await this.db.query<User>('select * from users where email=$1 and email_verified_at is null', [email.trim().toLowerCase()]);
    if (rows[0]) {
      const token = opaque();
      await this.db.query("insert into email_verifications values($1,$2,now()+interval '30 minutes')", [digest(token), rows[0].id]);
      await this.deliver(rows[0].email, token);
    }
    return { message: 'If eligible, a verification email has been sent.' };
  }

  async verifyEmail(token: unknown) {
    if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token)) throw new BadRequestException('Invalid verification link');
    const verified = await this.db.transaction(async c => {
      const { rows } = await c.query<{ user_id: string }>('delete from email_verifications where token_hash=$1 and expires_at>now() returning user_id', [digest(token)]);
      if (!rows[0]) return false;
      await c.query('update users set email_verified_at=coalesce(email_verified_at,now()) where id=$1', [rows[0].user_id]);
      await c.query('delete from email_verifications where user_id=$1', [rows[0].user_id]);
      return true;
    });
    if (!verified) throw new BadRequestException('Verification link expired or already used');
    return { message: 'Email verified. You can sign in.' };
  }

  async login(body: unknown) {
    const input = credentials(body);
    const { rows } = await this.db.query<User & { password_hash: string }>('select u.*,p.password_hash from users u join password_credentials p on p.user_id=u.id where u.email=$1', [input.email]);
    const user = rows[0];
    // Perform equivalent Argon2 work for unknown accounts to reduce timing disclosure.
    const hash = user?.password_hash ?? await (this.dummyHash ??= argon2.hash(opaque(), { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }));
    let valid = false;
    try { valid = await argon2.verify(hash, input.password); } catch { /* Invalid legacy/seed credentials fail safely. */ }
    if (!valid || !user) throw new UnauthorizedException('Invalid email or password');
    if (!user.email_verified_at) throw new ForbiddenException('Verify your email before signing in');
    return this.createSession(user.id, user.password_hash);
  }

  async createSession(userId: string, expectedPasswordHash?: string) {
    const id = randomUUID(), refresh = opaque();
    await this.db.transaction(async c => {
      // Serialize with password reset; a login using a pre-reset hash cannot
      // establish a fresh session after the reset has revoked older sessions.
      await c.query('select id from users where id=$1 for update', [userId]);
      if (expectedPasswordHash) {
        const credential = await c.query<{ password_hash: string }>('select password_hash from password_credentials where user_id=$1', [userId]);
        if (credential.rows[0]?.password_hash !== expectedPasswordHash) throw new UnauthorizedException('Invalid email or password');
      }
      await c.query("insert into auth_sessions(id,user_id,expires_at) values($1,$2,now()+interval '30 days')", [id,userId]);
      await c.query('insert into refresh_tokens(token_hash,session_id) values($1,$2)', [digest(refresh),id]);
    });
    return { access: await this.sign(userId, id), refresh };
  }

  private sign(userId: string, sessionId: string) {
    const config = authConfig();
    return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('10m').setIssuer(config.issuer).setAudience(config.audience).sign(config.secret);
  }

  async authenticate(token?: string) {
    if (!token) throw new UnauthorizedException();
    try {
      const config = authConfig();
      const { payload } = await jwtVerify(token, config.secret, { algorithms: ['HS256'], issuer: config.issuer, audience: config.audience });
      if (typeof payload.sid !== 'string' || typeof payload.sub !== 'string') throw new Error();
      const { rows } = await this.db.query<User>(`select u.* from users u join auth_sessions s on s.user_id=u.id where s.id=$1 and u.id=$2 and s.revoked_at is null and s.expires_at>now()`, [payload.sid,payload.sub]);
      if (!rows[0]) throw new Error();
      return { user: rows[0], sessionId: payload.sid };
    } catch { throw new UnauthorizedException(); }
  }

  async current(token?: string) {
    const { user } = await this.authenticate(token);
    const { rows } = await this.db.query<{ id: string; name: string }>('select o.id,o.name from organizations o join organization_members m on m.organization_id=o.id where m.user_id=$1 order by m.joined_at,o.id', [user.id]);
    return { user: { id: user.id, email: user.email, fullName: user.full_name }, organizations: rows, nextPath: rows.length ? '/projects' : '/onboarding' };
  }

  async refresh(token?: string) {
    if (!token || !/^[\w-]{43}$/.test(token)) throw new UnauthorizedException();
    const next = opaque();
    const result = await this.db.transaction(async c => {
      const { rows } = await c.query<{ id: string; user_id: string; revoked_at: Date | null; expires_at: Date; consumed_at: Date | null }>(`select s.*,t.consumed_at from auth_sessions s join refresh_tokens t on t.session_id=s.id where t.token_hash=$1 for update of s,t`, [digest(token)]);
      const s = rows[0];
      if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) return null;
      if (s.consumed_at) {
        // Return from transaction so revocation commits before the 401 is thrown.
        await c.query('update auth_sessions set revoked_at=now() where id=$1', [s.id]);
        return null;
      }
      await c.query('update refresh_tokens set consumed_at=now() where token_hash=$1', [digest(token)]);
      await c.query('insert into refresh_tokens(token_hash,session_id) values($1,$2)', [digest(next),s.id]);
      return s;
    });
    if (!result) throw new UnauthorizedException('Session expired or revoked');
    return { access: await this.sign(result.user_id,result.id), refresh: next };
  }

  async logout(token?: string) {
    if (token) await this.db.query('update auth_sessions set revoked_at=now() where id in (select session_id from refresh_tokens where token_hash=$1)', [digest(token)]);
  }

  async forgotPassword(body: unknown) {
    if (!process.env.AUTH_SMTP_URL || !process.env.AUTH_EMAIL_FROM) throw new ServiceUnavailableException('Password reset email delivery is not configured');
    const value = (body as { email?: unknown } | null)?.email;
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestException('Enter a valid email address.');
    const token = opaque();
    const recipient = await this.db.transaction(async c => {
      const { rows } = await c.query<User>('select u.* from users u join password_credentials p on p.user_id=u.id where u.email=$1 and u.email_verified_at is not null for update of u', [value.trim().toLowerCase()]);
      if (!rows[0]) return null;
      await c.query("insert into password_resets(token_hash,user_id,expires_at) values($1,$2,now()+interval '30 minutes')", [digest(token), rows[0].id]);
      return rows[0].email;
    });
    if (recipient) {
      try {
        await nodemailer.createTransport(process.env.AUTH_SMTP_URL).sendMail({ from: process.env.AUTH_EMAIL_FROM, to: recipient, subject: 'Reset your ChainOps password', text: `Reset your password within 30 minutes: ${authConfig().origin}/reset-password#token=${token}\n\nIf you did not request this, you can ignore this email.` });
      } catch {
        // Keep the public response identical, including on SMTP failure, so
        // account eligibility is not disclosed. A new request can be retried.
      }
    }
    return { message: 'If this email belongs to an eligible account, a password reset link will be sent. Check your inbox and spam folder.' };
  }

  async resetPassword(body: unknown) {
    const input = body as { token?: unknown; password?: unknown; confirmPassword?: unknown } | null;
    if (typeof input?.token !== 'string' || !/^[\w-]{43}$/.test(input.token)) throw new BadRequestException('Reset link is invalid, expired, or already used. Request a new link.');
    validateNewPassword(input.password);
    if (input.password !== input.confirmPassword) throw new BadRequestException('Passwords do not match.');
    const tokenHash = digest(input.token);
    const lookup = await this.db.query<{ user_id: string }>('select user_id from password_resets where token_hash=$1 and expires_at>now()', [tokenHash]);
    if (!lookup.rows[0]) throw new BadRequestException('Reset link is invalid, expired, or already used. Request a new link.');
    const hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const reset = await this.db.transaction(async c => {
      const id = lookup.rows[0].user_id;
      await c.query('select id from users where id=$1 for update', [id]);
      const consumed = await c.query('delete from password_resets where token_hash=$1 and user_id=$2 and expires_at>now() returning user_id', [tokenHash,id]);
      if (!consumed.rows[0]) return false;
      const updated = await c.query('update password_credentials set password_hash=$1 where user_id=$2 returning user_id', [hash,id]);
      if (!updated.rows[0]) throw new BadRequestException('Reset link is invalid, expired, or already used. Request a new link.');
      await c.query('update users set password_hash=null where id=$1', [id]);
      await c.query('delete from password_resets where user_id=$1', [id]);
      await c.query('update auth_sessions set revoked_at=now() where user_id=$1 and revoked_at is null', [id]);
      return true;
    });
    if (!reset) throw new BadRequestException('Reset link is invalid, expired, or already used. Request a new link.');
    return { message: 'Password updated. Sign in with your new password.' };
  }

  async revokeAll(access?: string) {
    const { user } = await this.authenticate(access);
    await this.db.query('update auth_sessions set revoked_at=now() where user_id=$1 and revoked_at is null', [user.id]);
  }

  async providerUser(provider: 'google' | 'github', subject: string, email: string, name: string) {
    try {
      return await this.db.transaction(async c => {
        const { rows } = await c.query<{ user_id: string }>('select user_id from auth_identities where provider=$1 and subject=$2', [provider,subject]);
        if (rows[0]) return rows[0].user_id;
        // Unique email conflicts intentionally require explicit future account linking.
        const created = await c.query<User>('insert into users(full_name,email,email_verified_at) values($1,$2,now()) returning *', [name.slice(0,120) || 'ChainOps user',email.toLowerCase()]);
        await c.query('insert into auth_identities(user_id,provider,subject) values($1,$2,$3)', [created.rows[0].id,provider,subject]);
        return created.rows[0].id;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        // The failed transaction has rolled back. A concurrent callback may have
        // committed this exact provider identity; never fall back to email.
        const { rows } = await this.db.query<{ user_id: string }>('select user_id from auth_identities where provider=$1 and subject=$2', [provider,subject]);
        if (rows[0]) return rows[0].user_id;
        throw new ConflictException('Account identity already exists. Sign in using its original method.');
      }
      throw error;
    }
  }
}
