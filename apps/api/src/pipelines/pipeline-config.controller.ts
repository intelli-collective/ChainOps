import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';
import { PipelineConfigService } from './pipeline-config.service.js';
import { parseCreate, parsePatch } from './pipeline-config.validation.js';

// The acting user always comes from the verified access token, never from the body.
@Controller('projects/:projectId/pipeline')
@UseGuards(AccessTokenGuard)
export class PipelineConfigController {
  constructor(@Inject(PipelineConfigService) private readonly pipelines: PipelineConfigService) {}

  @Post()
  @HttpCode(201)
  create(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.pipelines.create(projectId, req.userId, parseCreate(body));
  }

  @Get()
  get(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest) {
    return this.pipelines.get(projectId, req.userId);
  }

  @Patch()
  update(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.pipelines.update(projectId, req.userId, parsePatch(body));
  }
}
