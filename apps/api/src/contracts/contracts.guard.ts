import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

export type ArtifactRequest = Request & { artifactUserId: string };

@Injectable()
export class ContractsGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ArtifactRequest>();
    // Auth cookies are scoped to /auth. Explicit bearer credentials reuse the
    // existing JWT + persisted session validation without changing shared auth.
    const match = /^Bearer (\S+)$/i.exec(req.get('Authorization') ?? '');
    if (!match) throw new UnauthorizedException('Bearer access token required');
    const { user } = await this.auth.authenticate(match[1]);
    req.artifactUserId = user.id;
    return true;
  }
}
