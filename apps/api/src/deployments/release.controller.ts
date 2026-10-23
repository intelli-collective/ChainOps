import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReleaseService } from './release.service.js';
import { ReleaseGuard } from './release.guard.js';
import type { ReleaseRequest } from './release.guard.js';

@Controller('api/projects/:projectId/release')
@UseGuards(ReleaseGuard)
export class ReleaseController {
  constructor(
    @Inject(ReleaseService) private readonly release: ReleaseService,
  ) {}
  @Get('artifacts') artifacts(@Param('projectId') p: string) {
    return this.release.artifacts(p);
  }
  @Get('networks') networks(@Param('projectId') p: string) {
    return this.release.networks(p);
  }
  @Post('preflight') preflight(
    @Param('projectId') p: string,
    @Body() body: unknown,
  ) {
    return this.release.preflight(p, body);
  }
  @Get('deployments') deployments(
    @Param('projectId') p: string,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.deployments(p, req.releaseUserId);
  }
  @Get('deployments/:id') deployment(
    @Param('projectId') p: string,
    @Param('id') id: string,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.deployments(p, req.releaseUserId, id);
  }
  @Post('deployments') submit(
    @Param('projectId') p: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.release.submit(p, body, key);
  }
  @Post('deployments/:id/reconcile') reconcile(
    @Param('projectId') p: string,
    @Param('id') id: string,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.reconcile(p, req.releaseUserId, id);
  }
  @Get('registry') registry(
    @Param('projectId') p: string,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.registry(p, req.releaseUserId);
  }
  @Get('registry/:id') contract(
    @Param('projectId') p: string,
    @Param('id') id: string,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.registry(p, req.releaseUserId, id);
  }
  @Post('registry') register(
    @Param('projectId') p: string,
    @Body() body: unknown,
    @Req() req: ReleaseRequest,
  ) {
    return this.release.register(p, req.releaseUserId, body);
  }
}
