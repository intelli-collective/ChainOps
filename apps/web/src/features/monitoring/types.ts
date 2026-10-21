export type TimeRange = '1h' | '24h' | '7d'
export type MockScenario = 'success' | 'empty' | 'error'
export interface MonitoredContract {
  id: string
  name: string
  address: string
  network: string
  status: 'active' | 'paused'
}
export interface ContractEvent {
  id: string
  contractId: string
  name: 'Deposit' | 'Transfer' | 'Withdrawal'
  block: number
  timestamp: string
}
export interface MonitoringAlert {
  id: string
  contractId: string
  message: string
  status: 'Error' | 'Retrying' | 'Recovered'
}
export interface MonitoringSnapshot {
  eventRate: number
  lastBlock: number
  lagSeconds: number
  contracts: MonitoredContract[]
  events: ContractEvent[]
  alerts: MonitoringAlert[]
  throughput: { label: string; deposit: number; transfer: number; withdrawal: number }[]
}
