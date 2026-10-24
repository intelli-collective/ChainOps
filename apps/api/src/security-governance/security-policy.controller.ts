import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireCsrf } from '../auth/csrf.js';
import { ProjectAccessService } from './project-access.service.js';
import { parseSecurityPolicyDto } from './security-policy.dto.js';
import { SecurityPolicyService } from './security-policy.service.js';

@Controller('projects/:projectId/security-policies')
export class SecurityPolicyController {
  constructor(
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(SecurityPolicyService) private readonly policies: SecurityPolicyService,
  ) {}

  @Post()
  async create(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: Request, @Body() body: unknown) {
    await this.access.requireMember(projectId, req);
    requireCsrf(req);
    return this.policies.create(projectId, parseSecurityPolicyDto(body));
  }

  @Get()
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: Request) {
    await this.access.requireMember(projectId, req);
    return this.policies.list(projectId);
  }
}
