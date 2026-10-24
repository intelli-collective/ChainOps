import { ReleaseController } from './deployments/release.controller.js';
import { ReleaseService } from './deployments/release.service.js';
import { ReleaseGuard } from './deployments/release.guard.js';
import { ReleaseIntegration } from './deployments/release.integration.js';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseService } from './database/database.service.js';
import { HealthController } from './database/health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { OAuthService } from './auth/oauth.service.js';
import { OAuthController } from './auth/oauth.controller.js';
import { MonitoringController } from './monitoring/monitoring.controller.js';
import { MonitoringService } from './monitoring/monitoring.service.js';
import { MonitoringAuthGuard } from './monitoring/monitoring-auth.guard.js';
import { PipelineConfigController } from './pipelines/pipeline-config.controller.js';
import { PipelineConfigService } from './pipelines/pipeline-config.service.js';
import { AccessTokenGuard } from './pipelines/access-token.guard.js';
import { PipelineRunsController } from './pipelines/pipeline-runs.controller.js';
import { PipelineRunsService } from './pipelines/pipeline-runs.service.js';
import { PipelineWorkerService } from './pipelines/pipeline-worker.service.js';
import { GitHubController } from './pipelines/github.controller.js';
import { GitHubService } from './pipelines/github.service.js';
import { ProjectLookupController } from './pipelines/project-lookup.controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { AssistantController, EnvironmentsController, InvitationsController, NotificationsController, OrganizationsController, ProjectsController, SearchController } from './platform/platform.controllers.js';
import { AssistantService } from './platform/assistant.service.js';
import { EnvironmentsService } from './platform/environments.service.js';
import { InvitationsService } from './platform/invitations.service.js';
import { NotificationsService } from './platform/notifications.service.js';
import { OrganizationsService } from './platform/organizations.service.js';
import { ProjectsService } from './platform/projects.service.js';
import { SearchService } from './platform/search.service.js';
import { ProjectAccessService } from './security-governance/project-access.service.js';
import { SecurityPolicyController } from './security-governance/security-policy.controller.js';
import { SecurityPolicyService } from './security-governance/security-policy.service.js';
import { ApprovalRequestController } from './security-governance/approval-request.controller.js';
import { ApprovalRequestService } from './security-governance/approval-request.service.js';
import { ContractsController } from './contracts/contracts.controller.js';
import { ContractsService } from './contracts/contracts.service.js';
import { ContractsGuard } from './contracts/contracts.guard.js';
import { MonitoringProjectsController, MonitoringRuntimeController } from './monitoring/runtime.controller.js';
import { MonitoringRuntimeService } from './monitoring/runtime.service.js';
import { RegistryGateway } from './monitoring/registry.gateway.js';
import { ChainGateway } from './monitoring/chain.gateway.js';
import { MonitoringWorker } from './monitoring/monitoring.worker.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
  ],
 controllers: [ReleaseController, AppController, HealthController, AuthController, OAuthController, ContractsController, SecurityPolicyController, ApprovalRequestController, PipelineConfigController, PipelineRunsController, GitHubController, ProjectLookupController, PipelineConfigController, MonitoringController, MonitoringRuntimeController, MonitoringProjectsController, OrganizationsController, ProjectsController, InvitationsController, NotificationsController, EnvironmentsController, SearchController, AssistantController],

providers: [ReleaseService, ReleaseGuard, ReleaseIntegration, AppService, DatabaseService, AuthService, OAuthService, ContractsService, ContractsGuard, ProjectAccessService, SecurityPolicyService, ApprovalRequestService, PipelineConfigService, PipelineRunsService, PipelineWorkerService, GitHubService, AccessTokenGuard, MonitoringService, MonitoringAuthGuard, SessionGuard, MonitoringRuntimeService, RegistryGateway, ChainGateway, MonitoringWorker, NotificationsService, InvitationsService, OrganizationsService, ProjectsService, EnvironmentsService, SearchService, AssistantService],
})
export class AppModule {}
