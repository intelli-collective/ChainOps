import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { requireCsrf } from '../auth/csrf.js';

export type MonitoringRequest = Request & { monitoringUserId: string };

@Injectable()
export class MonitoringAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<MonitoringRequest>();
    const authorization = req.get('authorization');
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
    if (authorization && !match)
      throw new UnauthorizedException('Invalid Bearer authorization');
    const cookie = (req.cookies as Record<string, string> | undefined)
      ?.chainops_access;
    const token = match?.[1] ?? cookie;
    if (!token)
      throw new UnauthorizedException('A Bearer access token is required');
    const { user } = await this.auth.authenticate(token);
    // Reuse the merged M5 root-path access cookie. Cookie-authenticated writes
    // require the existing Origin + double-submit CSRF protection.
    if (!match && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      requireCsrf(req);
    req.monitoringUserId = user.id;
    return true;
  }
}
