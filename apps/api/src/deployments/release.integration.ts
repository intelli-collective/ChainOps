import { Injectable } from '@nestjs/common';

export interface PublicDeploymentNetwork {
  id: string;
  name: string;
  chainId: number;
  environment: string;
  rpcLabel: string;
  connected: boolean;
  signingAvailable: boolean;
}

/** Replace through Nest DI with M1/M4 publication and M5 environment adapters.
 * No client request can supply eligibility, approvals, bytecode, accounts or RPC URLs.
 * The current repository has no published artifacts/approval decisions or signer.
 */
@Injectable()
export class ReleaseIntegration {
  artifacts(_projectId: string): Promise<unknown[]> {
    return Promise.resolve([]);
  }
  networks(_projectId: string): Promise<PublicDeploymentNetwork[]> {
    return Promise.resolve([]);
  }
}
