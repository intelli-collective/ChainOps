import { Module } from '@nestjs/common';

// Controllers and providers are added in the policy and request API stages.
// No runtime route is registered until authentication and project access exist.
@Module({})
export class SecurityGovernanceModule {}
