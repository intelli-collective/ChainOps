import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContractsService } from './contracts.service.js';
import { ContractsGuard } from './contracts.guard.js';
import type { ArtifactRequest } from './contracts.guard.js';

@Controller('projects/:projectId/contracts')
@UseGuards(ContractsGuard)
export class ContractsController {
  constructor(
    @Inject(ContractsService) private readonly contracts: ContractsService,
  ) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: ArtifactRequest,
    @Body() body: unknown,
  ) {
    return this.contracts.create(projectId, req.artifactUserId, body);
  }

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: ArtifactRequest,
  ) {
    return this.contracts.list(projectId, req.artifactUserId);
  }

  @Get(':contractId')
  get(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contractId', new ParseUUIDPipe()) contractId: string,
    @Req() req: ArtifactRequest,
  ) {
    return this.contracts.get(projectId, req.artifactUserId, contractId);
  }
}
