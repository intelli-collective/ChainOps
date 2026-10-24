import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { requireCsrf } from './csrf.js';

export type SessionRequest = Request & { userId: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Shared platform guard. Accepts the access token as `Authorization: Bearer <token>`
 * (API clients) or as the HttpOnly `chainops_access` cookie (web app); both are
 * validated with the server-side session by AuthService.authenticate. Cookie
 * writes also require the CSRF token. Fails closed.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const [scheme, bearer] = request.get('authorization')?.split(' ') ?? [];
    const cookie = (request.cookies as Record<string, unknown> | undefined)?.chainops_access;
    let token: string | undefined;
    if (scheme === 'Bearer' && bearer) {
      token = bearer;
    } else if (typeof cookie === 'string' && cookie) {
      token = cookie;
      if (!SAFE_METHODS.has(request.method)) requireCsrf(request);
    }
    if (!token) throw new UnauthorizedException('Sign in to continue');
    const { user } = await this.auth.authenticate(token);
    request.userId = user.id;
    return true;
  }
}
