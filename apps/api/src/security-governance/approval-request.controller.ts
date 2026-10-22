import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireCsrf } from '../auth/csrf.js';
import { ProjectAccessService } from './project-access.service.js';
import { parseApprovalRequestDto } from './approval-request.dto.js';
import { ApprovalRequestService } from './approval-request.service.js';

@Controller('projects/:projectId/approval-requests')
export class ApprovalRequestController {
  constructor(
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(ApprovalRequestService) private readonly requests: ApprovalRequestService,
  ) {}

  @Post()
  async create(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: Request, @Body() body: unknown) {
    const requesterId = await this.access.requireMember(projectId, req);
    requireCsrf(req);
    return this.requests.create(projectId, requesterId, parseApprovalRequestDto(body));
  }

  @Get()
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: Request) {
    await this.access.requireMember(projectId, req);
    return this.requests.list(projectId);
  }
}
