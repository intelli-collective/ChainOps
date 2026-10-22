import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MonitoringAuthGuard } from './monitoring-auth.guard.js';
import type { MonitoringRequest } from './monitoring-auth.guard.js';
import { MonitoringService } from './monitoring.service.js';

@Controller('projects/:projectId')
@UseGuards(MonitoringAuthGuard)
export class MonitoringController {
  constructor(
    @Inject(MonitoringService) private readonly monitoring: MonitoringService,
  ) {}

  @Post('monitored-contracts')
  @Header('Cache-Control', 'no-store')
  createMonitor(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: MonitoringRequest,
    @Body() body: unknown,
  ) {
    return this.monitoring.createMonitor(projectId, req.monitoringUserId, body);
  }

  @Get('monitored-contracts')
  @Header('Cache-Control', 'no-store')
  listMonitors(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.monitoring.listMonitors(projectId, req.monitoringUserId);
  }

  @Post('alert-rules')
  @Header('Cache-Control', 'no-store')
  createRule(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: MonitoringRequest,
    @Body() body: unknown,
  ) {
    return this.monitoring.createRule(projectId, req.monitoringUserId, body);
  }

  @Get('alert-rules')
  @Header('Cache-Control', 'no-store')
  listRules(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.monitoring.listRules(projectId, req.monitoringUserId);
  }
}
