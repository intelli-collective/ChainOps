export type MonitoringStatus = 'Healthy' | 'Degraded' | 'Paused'
export type ContractStatus = 'Active' | 'Inactive'

export interface ContractRecord {
  id: string
  projectId: string
  name: string
  version: string
  address: string
  network: string
  monitoring: MonitoringStatus
  status: ContractStatus
  releaseCommit?: string
  releaseRun?: number
  transactionHash: string
  deployedAt: string
}

export interface RegisterContractInput {
  projectId: string
  name: string
  version: string
  address: string
  network: string
  transactionHash: string
}

export interface ContractRegistryService {
  getContracts(projectId: string): Promise<ContractRecord[]>
  registerExistingContract(input: RegisterContractInput): Promise<ContractRecord>
}
