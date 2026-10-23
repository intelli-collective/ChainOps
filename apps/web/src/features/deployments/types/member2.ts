export interface AbiInput {
  name: string
  type: string
  components?: AbiInput[]
}
export interface AbiEntry {
  type: string
  name?: string
  inputs?: AbiInput[]
  outputs?: AbiInput[]
  stateMutability?: string
}
export interface DeploymentArtifact {
  id: string
  projectId: string
  name: string
  version: string
  fileName: string
  sizeKb: number
  commitSha: string
  pipelineRunId: string
  runNumber: number
  branch: string
  title: string
  digest: string
  source: string
  compiler: string
  abi: AbiEntry[]
  metadata?: {
    optimizerRuns?: number
    evm?: string
    uri?: string
    license?: string
    contractType?: string
  }
  approvalId: string
  policyResultId: string
  approvals: number
  requiredApprovals: number
}
export interface DeploymentNetwork {
  id: string
  name: string
  chainId: number
  environment: string
  rpcLabel: string
  explorerUrl?: string
  account?: string
  balance?: string
  latestBlock?: number
  connected: boolean
  latencyMs?: number
  signingAvailable: boolean
}
export type TransactionStatus =
  | 'PREPARING'
  | 'SUBMITTED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REVERTED'
  | 'UNKNOWN'
export interface DeploymentDraft {
  artifactId: string
  networkId: string
  parameters: string[]
}
export interface PreflightCheck {
  label: string
  passed: boolean
}
export interface PreflightResult {
  eligible: boolean
  checks: PreflightCheck[]
  reason?: string
  estimatedGas?: string
  estimatedCost?: string
  account?: string
}
export interface DeploymentRecord {
  id: string
  projectId: string
  artifact: DeploymentArtifact
  network: DeploymentNetwork
  parameters: string[]
  status: TransactionStatus
  requestedBy: string
  submittedAt: string
  transactionHash?: string
  contractAddress?: string
  contractId?: string
  blockNumber?: number
  targetContracts?: string[]
  confirmations: number
  requiredConfirmations: number
  minedAt?: string
  gasUsed?: string
  gasPrice?: string
  transactionFee?: string
  reason?: string
  receipt?: Record<string, unknown>
  logs?: Record<string, unknown>[]
}
export interface RegisteredContract {
  id: string
  projectId: string
  name: string
  version: string
  address: string
  network: DeploymentNetwork
  provenance: 'external' | 'deployment'
  status: 'Active' | 'Registered' | 'Inactive'
  monitoring: 'Healthy' | 'Degraded' | 'Not enabled'
  createdAt: string
  recentEvents?: { timestamp: string; name: string; summary: string }[]
  deploymentId?: string
  artifact?: DeploymentArtifact
  transactionHash?: string
}
export interface ExistingContractInput {
  name: string
  version: string
  address: string
  networkId: string
}
export interface Member2Service {
  preview?: boolean
  artifacts(projectId: string): Promise<DeploymentArtifact[]>
  networks(projectId: string): Promise<DeploymentNetwork[]>
  deployments(projectId: string): Promise<DeploymentRecord[]>
  deployment(projectId: string, id: string): Promise<DeploymentRecord>
  preflight(projectId: string, draft: DeploymentDraft): Promise<PreflightResult>
  submit(
    projectId: string,
    draft: DeploymentDraft,
    idempotencyKey: string
  ): Promise<DeploymentRecord>
  reconcile(projectId: string, id: string): Promise<DeploymentRecord>
  contracts(projectId: string): Promise<RegisteredContract[]>
  contract(projectId: string, id: string): Promise<RegisteredContract>
  register(
    projectId: string,
    input: ExistingContractInput
  ): Promise<RegisteredContract>
}

export interface Member2Scope {
  projectId: string
  service: Member2Service
  root: string
}
