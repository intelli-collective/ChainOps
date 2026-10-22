import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

export type AuthenticatedRequest = Request & { userId: string };

// Accepts the ChainOps access token (the `chainops_access` JWT issued by /auth/login)
// as `Authorization: Bearer <token>` and validates it, including the server-side
// session, through AuthService.authenticate. Fails closed: no token, no access.
// Bearer tokens are never attached by browsers automatically, so these routes
// need no CSRF token.
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.get('authorization')?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer access token');
    const { user } = await this.auth.authenticate(token);
    request.userId = user.id;
    return true;
  }
}
