import type { ContractEvent, MonitoredContract } from '../types'

export interface DecodedParameter {
  name: string
  type: string
  value: string
}
export interface ExplorerEvent extends ContractEvent {
  transactionHash: string
  logIndex: number
  parameters: DecodedParameter[]
}
export interface EventsSnapshot {
  contracts: MonitoredContract[]
  events: ExplorerEvent[]
}
export interface EventFilters {
  contractId: string
  eventType: string
  from: string
  to: string
  minBlock: string
  maxBlock: string
}
