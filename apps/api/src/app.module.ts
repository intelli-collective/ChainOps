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
import { ProjectAccessService } from './security-governance/project-access.service.js';
import { SecurityPolicyController } from './security-governance/security-policy.controller.js';
import { SecurityPolicyService } from './security-governance/security-policy.service.js';
import { ApprovalRequestController } from './security-governance/approval-request.controller.js';
import { ApprovalRequestService } from './security-governance/approval-request.service.js';

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
  controllers: [AppController, HealthController, AuthController, OAuthController, SecurityPolicyController, ApprovalRequestController],
  providers: [AppService, DatabaseService, AuthService, OAuthService, ProjectAccessService, SecurityPolicyService, ApprovalRequestService],
})
export class AppModule {}
