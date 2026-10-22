import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

export type MonitoringRequest = Request & { monitoringUserId: string };

@Injectable()
export class MonitoringAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<MonitoringRequest>();
    // Existing HttpOnly cookies have Path=/auth. Explicit Bearer authorization
    // reuses the same JWT/session verification without expanding cookie scope.
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') ?? '');
    if (!match)
      throw new UnauthorizedException('A Bearer access token is required');
    const { user } = await this.auth.authenticate(match[1]);
    req.monitoringUserId = user.id;
    return true;
  }
}
