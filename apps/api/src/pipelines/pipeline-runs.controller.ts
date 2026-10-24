import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';
import { PipelineRunsService } from './pipeline-runs.service.js';

// Creating a run only persists it and enqueues a job; execution happens in the worker.
@Controller('projects/:projectId/pipeline')
@UseGuards(AccessTokenGuard)
export class PipelineRunsController {
  constructor(@Inject(PipelineRunsService) private readonly runs: PipelineRunsService) {}

  @Get('branches')
  branches(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.branches(projectId, req.userId);
  }

  @Get('runs')
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.list(projectId, req.userId);
  }

  @Post('runs')
  @HttpCode(201)
  create(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.runs.create(projectId, req.userId, body);
  }

  @Get('runs/:runId')
  get(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('runId', new ParseUUIDPipe()) runId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.get(projectId, req.userId, runId);
  }

  @Post('runs/:runId/cancel')
  @HttpCode(200)
  cancel(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('runId', new ParseUUIDPipe()) runId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.cancel(projectId, req.userId, runId);
  }

  @Post('runs/:runId/rerun')
  @HttpCode(201)
  rerun(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('runId', new ParseUUIDPipe()) runId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.rerun(projectId, req.userId, runId);
  }

  @Get('runs/:runId/artifacts')
  artifacts(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('runId', new ParseUUIDPipe()) runId: string, @Req() req: AuthenticatedRequest) {
    return this.runs.artifacts(projectId, req.userId, runId);
  }

  @Get('runs/:runId/artifacts/:artifactId')
  artifact(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
    @Param('artifactId', new ParseUUIDPipe()) artifactId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.runs.artifact(projectId, req.userId, runId, artifactId);
  }
}
