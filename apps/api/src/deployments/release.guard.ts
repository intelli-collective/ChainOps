import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from './release.service.js';
import { ProjectAccessService } from '../security-governance/project-access.service.js';
import { requireCsrf } from '../auth/csrf.js';
export type ReleaseRequest = Request & { releaseUserId: string };
@Injectable()
export class ReleaseGuard implements CanActivate {
  constructor(
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ReleaseRequest>();
    const projectId = String(req.params.projectId);
    isUUID(projectId);
    if (!['GET', 'HEAD'].includes(req.method)) requireCsrf(req);
    req.releaseUserId = await this.access.requireMember(projectId, req);
    return true;
  }
}
