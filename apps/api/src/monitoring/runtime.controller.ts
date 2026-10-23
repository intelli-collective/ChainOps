import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  MonitoringAuthGuard,
  type MonitoringRequest,
} from './monitoring-auth.guard.js';
import { MonitoringRuntimeService } from './runtime.service.js';

@Controller('projects/:projectId/monitoring')
@UseGuards(MonitoringAuthGuard)
export class MonitoringRuntimeController {
  constructor(
    @Inject(MonitoringRuntimeService)
    private readonly runtime: MonitoringRuntimeService,
  ) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
    @Query('range') range = '24h',
  ) {
    return this.runtime.overview(p, req.monitoringUserId, range);
  }
  @Get('registry-contracts')
  @Header('Cache-Control', 'no-store')
  registry(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.registryContracts(p, req.monitoringUserId);
  }
  @Get('watchers')
  @Header('Cache-Control', 'no-store')
  watchers(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.watchers(p, req.monitoringUserId);
  }
  @Post('targets')
  target(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.addTarget(p, req.monitoringUserId, b);
  }
  @Patch('watchers/:id')
  settings(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.settings(p, req.monitoringUserId, id, b);
  }
  @Get('watchers/:id/catalog')
  @Header('Cache-Control', 'no-store')
  catalog(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.catalog(p, req.monitoringUserId, id);
  }
  @Post('watchers/:id/subscriptions')
  subscribe(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.addSubscription(p, req.monitoringUserId, id, b);
  }
  @Delete('watchers/:id/subscriptions/:subscriptionId')
  unsubscribe(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('subscriptionId', new ParseUUIDPipe()) subscriptionId: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.removeSubscription(
      p,
      req.monitoringUserId,
      id,
      subscriptionId,
    );
  }
  @Post('test-connection')
  @HttpCode(200)
  test(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.testConnection(p, req.monitoringUserId);
  }
  @Get('events')
  @Header('Cache-Control', 'no-store')
  events(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.runtime.events(p, req.monitoringUserId, query);
  }
  @Get('events/:id')
  @Header('Cache-Control', 'no-store')
  event(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.event(p, req.monitoringUserId, id);
  }
  @Get('rules')
  @Header('Cache-Control', 'no-store')
  rules(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.rules(p, req.monitoringUserId);
  }
  @Post('rules')
  createRule(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.createRule(p, req.monitoringUserId, b);
  }
  @Patch('rules/:id')
  toggle(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.toggleRule(p, req.monitoringUserId, id, b);
  }
  @Get('alerts')
  @Header('Cache-Control', 'no-store')
  alerts(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Req() req: MonitoringRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.runtime.alerts(p, req.monitoringUserId, query);
  }
  @Get('alerts/:id')
  @Header('Cache-Control', 'no-store')
  alert(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
  ) {
    return this.runtime.alert(p, req.monitoringUserId, id);
  }
  @Post('alerts/:id/acknowledge')
  @HttpCode(200)
  acknowledge(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.transition(
      p,
      req.monitoringUserId,
      id,
      'acknowledged',
      b,
    );
  }
  @Post('alerts/:id/resolve')
  @HttpCode(200)
  resolve(
    @Param('projectId', new ParseUUIDPipe()) p: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: MonitoringRequest,
    @Body() b: unknown,
  ) {
    return this.runtime.transition(p, req.monitoringUserId, id, 'resolved', b);
  }
}

@Controller('monitoring')
@UseGuards(MonitoringAuthGuard)
export class MonitoringProjectsController {
  constructor(
    @Inject(MonitoringRuntimeService)
    private readonly runtime: MonitoringRuntimeService,
  ) {}
  @Get('projects')
  @Header('Cache-Control', 'no-store')
  projects(@Req() req: MonitoringRequest) {
    return this.runtime.projects(req.monitoringUserId);
  }
}
