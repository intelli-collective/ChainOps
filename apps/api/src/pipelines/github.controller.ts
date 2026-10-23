import { BadRequestException, Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';
import { GitHubService } from './github.service.js';
import { requireProjectMember } from './pipeline-access.js';

// Repository selection for the project setup "Connect repository" step.
@Controller('projects/:projectId/github')
@UseGuards(AccessTokenGuard)
export class GitHubController {
  constructor(
    @Inject(GitHubService) private readonly github: GitHubService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  @Get('status')
  async status(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest) {
    await requireProjectMember(this.db, projectId, req.userId);
    return this.github.status();
  }

  @Get('repositories')
  async repositories(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest, @Query('owner') owner?: string) {
    await requireProjectMember(this.db, projectId, req.userId);
    if (!owner) throw new BadRequestException('Query parameter "owner" is required.');
    return this.github.listRepositories(owner);
  }

  @Get('branches')
  async branches(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Req() req: AuthenticatedRequest, @Query('repository') repository?: string) {
    await requireProjectMember(this.db, projectId, req.userId);
    if (!repository) throw new BadRequestException('Query parameter "repository" is required.');
    return this.github.listBranches(repository);
  }
}
