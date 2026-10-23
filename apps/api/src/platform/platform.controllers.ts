import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard, type SessionRequest } from '../auth/session.guard.js';
import { AssistantService } from './assistant.service.js';
import { EnvironmentsService } from './environments.service.js';
import { InvitationsService } from './invitations.service.js';
import { SearchService } from './search.service.js';
import { NotificationsService } from './notifications.service.js';
import { OrganizationsService } from './organizations.service.js';
import { ProjectsService } from './projects.service.js';

const uuid = new ParseUUIDPipe();

@Controller('organizations')
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService) private readonly orgs: OrganizationsService,
    @Inject(ProjectsService) private readonly projectService: ProjectsService,
  ) {}

  @Get() mine(@Req() req: SessionRequest) { return this.orgs.mine(req.userId); }
  @Post() @HttpCode(201) create(@Req() req: SessionRequest, @Body() body: unknown) { return this.orgs.create(req.userId, body); }
  @Get(':orgId') get(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string) { return this.orgs.get(req.userId, orgId); }
  @Patch(':orgId') update(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Body() body: unknown) { return this.orgs.update(req.userId, orgId, body); }
  @Get(':orgId/projects') projects(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string) { return this.orgs.projects(req.userId, orgId); }
  @Get(':orgId/members') members(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string) { return this.orgs.members(req.userId, orgId); }
  @Patch(':orgId/members/:userId') changeRole(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Param('userId', uuid) userId: string, @Body() body: unknown) { return this.orgs.changeRole(req.userId, orgId, userId, body); }
  @Delete(':orgId/members/:userId') remove(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Param('userId', uuid) userId: string) { return this.orgs.removeMember(req.userId, orgId, userId); }
  @Post(':orgId/invitations') @HttpCode(201) invite(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Body() body: unknown) { return this.orgs.invite(req.userId, orgId, body); }
  @Delete(':orgId/invitations/:invitationId') revoke(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Param('invitationId', uuid) id: string) { return this.orgs.revokeInvitation(req.userId, orgId, id); }
  @Get(':orgId/integrations') integrations(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string) { return this.orgs.integrations(req.userId, orgId); }
  @Put(':orgId/integrations/github') connect(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Body() body: unknown) { return this.orgs.connectGitHub(req.userId, orgId, body); }
  @Delete(':orgId/integrations/github') disconnect(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string) { return this.orgs.disconnectGitHub(req.userId, orgId); }
  // Project creation lives on the organization route; the project service owns it.
  @Post(':orgId/projects') @HttpCode(201) createProject(@Req() req: SessionRequest, @Param('orgId', uuid) orgId: string, @Body() body: unknown) {
    return this.projectService.create(req.userId, orgId, body);
  }

}

@Controller('projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  // `:ref` accepts the project id or its slug (resolved within the user's organizations).
  @Get(':ref') get(@Req() req: SessionRequest, @Param('ref') ref: string) { return this.projects.get(req.userId, ref); }
  @Patch(':projectId') update(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Body() body: unknown) { return this.projects.update(req.userId, id, body); }
  @Get(':projectId/overview') overview(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.projects.overview(req.userId, id); }
  @Get(':projectId/team') team(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.projects.team(req.userId, id); }
  @Patch(':projectId/team/:userId') changeRole(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('userId', uuid) userId: string, @Body() body: unknown) { return this.projects.changeMemberRole(req.userId, id, userId, body); }
  @Post(':projectId/invitations') @HttpCode(201) invite(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Body() body: unknown) { return this.projects.invite(req.userId, id, body); }
  @Delete(':projectId/invitations/:invitationId') revoke(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('invitationId', uuid) invitationId: string) { return this.projects.revokeInvitation(req.userId, id, invitationId); }
  @Post(':projectId/complete-setup') @HttpCode(200) complete(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.projects.completeSetup(req.userId, id); }
}

@Controller('invitations')
@UseGuards(SessionGuard)
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  @Get('mine') mine(@Req() req: SessionRequest) { return this.invitations.mine(req.userId); }
  @Get('by-token/:token') byToken(@Req() req: SessionRequest, @Param('token') token: string) { return this.invitations.byToken(req.userId, token); }
  @Post(':invitationId/accept') @HttpCode(200) accept(@Req() req: SessionRequest, @Param('invitationId', uuid) id: string) { return this.invitations.accept(req.userId, id); }
}

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get() list(@Req() req: SessionRequest, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    const parsed = Math.min(Math.max(Number.parseInt(limit ?? '50', 10) || 50, 1), 100);
    return this.notifications.list(req.userId, { unreadOnly: unread === 'true', limit: parsed });
  }
  @Post('read-all') @HttpCode(200) readAll(@Req() req: SessionRequest) { return this.notifications.markAllRead(req.userId); }
  @Post(':id/read') @HttpCode(200) read(@Req() req: SessionRequest, @Param('id', uuid) id: string) { return this.notifications.markRead(req.userId, id); }
}

@Controller('projects/:projectId')
@UseGuards(SessionGuard)
export class EnvironmentsController {
  constructor(@Inject(EnvironmentsService) private readonly envs: EnvironmentsService) {}

  @Get('environments') list(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.envs.list(req.userId, id); }
  @Post('environments') @HttpCode(201) create(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Body() body: unknown) { return this.envs.create(req.userId, id, body); }
  @Patch('environments/:envId') update(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('envId', uuid) envId: string, @Body() body: unknown) { return this.envs.update(req.userId, id, envId, body); }
  @Delete('environments/:envId') remove(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('envId', uuid) envId: string) { return this.envs.remove(req.userId, id, envId); }
  @Post('environments/:envId/check') @HttpCode(200) check(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('envId', uuid) envId: string) { return this.envs.check(req.userId, id, envId); }

  @Get('variables') variables(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.envs.variables(req.userId, id); }
  @Post('variables') @HttpCode(201) createVariable(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Body() body: unknown) { return this.envs.createVariable(req.userId, id, body); }
  @Patch('variables/:variableId') updateVariable(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('variableId', uuid) variableId: string, @Body() body: unknown) { return this.envs.updateVariable(req.userId, id, variableId, body); }
  @Delete('variables/:variableId') removeVariable(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Param('variableId', uuid) variableId: string) { return this.envs.removeVariable(req.userId, id, variableId); }
}

@Controller('search')
@UseGuards(SessionGuard)
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get() search(@Req() req: SessionRequest, @Query('q') q?: string) { return this.searchService.search(req.userId, q); }
}

@Controller('projects/:projectId/assistant')
@UseGuards(SessionGuard)
export class AssistantController {
  constructor(@Inject(AssistantService) private readonly assistant: AssistantService) {}

  @Get() status(@Req() req: SessionRequest, @Param('projectId', uuid) id: string) { return this.assistant.status(req.userId, id); }
  @Post() @HttpCode(200) ask(@Req() req: SessionRequest, @Param('projectId', uuid) id: string, @Body() body: unknown) { return this.assistant.ask(req.userId, id, body); }
}
