import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { requireCsrf } from '../auth/csrf.js';

export type AuthenticatedRequest = Request & { userId: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Accepts the ChainOps access token issued by /auth/login either as
// `Authorization: Bearer <token>` (API clients such as Postman) or as the
// HttpOnly `chainops_access` cookie (the web app). Both are validated, including
// the server-side session, by AuthService.authenticate. Cookie-authenticated
// writes also require the CSRF token, because browsers attach cookies
// automatically; Bearer tokens are never attached automatically. Fails closed.
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, bearer] = request.get('authorization')?.split(' ') ?? [];
    const cookie = (request.cookies as Record<string, unknown> | undefined)?.chainops_access;
    let token: string | undefined;
    if (scheme === 'Bearer' && bearer) {
      token = bearer;
    } else if (typeof cookie === 'string' && cookie) {
      token = cookie;
      if (!SAFE_METHODS.has(request.method)) requireCsrf(request);
    }
    if (!token) throw new UnauthorizedException('Missing bearer access token');
    const { user } = await this.auth.authenticate(token);
    request.userId = user.id;
    return true;
  }
}
