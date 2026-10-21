import type { ContractRecord } from '../types'

export const mockContracts: ContractRecord[] = [
  {
    id: 'vault-v1-4', projectId: 'chainvault', name: 'Vault', version: 'v1.4',
    address: '0x3f2a1849b7c045ae623da91f664231819b7e9c1d', network: 'Sepolia',
    monitoring: 'Healthy', status: 'Active', releaseCommit: 'a3f9c2e', releaseRun: 128,
    transactionHash: `0x${'a3f9c2e4'.repeat(8)}`, deployedAt: '2026-10-18T09:40:00Z',
  },
  {
    id: 'token-factory-v1-4', projectId: 'chainvault', name: 'TokenFactory', version: 'v1.4',
    address: '0x7b6e45ae9b9d41fd6c295ddc06192f612b7d2d44', network: 'Sepolia',
    monitoring: 'Healthy', status: 'Active', releaseCommit: 'a3f9c2e', releaseRun: 128,
    transactionHash: `0x${'7b6e45ae'.repeat(8)}`, deployedAt: '2026-10-18T09:44:00Z',
  },
  {
    id: 'treasury-v1-4', projectId: 'chainvault', name: 'Treasury', version: 'v1.4',
    address: '0x8d11a4968b3f4878da14f328a57bc008415e6f02', network: 'Sepolia',
    monitoring: 'Degraded', status: 'Active', releaseCommit: 'a3f9c2e', releaseRun: 128,
    transactionHash: `0x${'8d11a496'.repeat(8)}`, deployedAt: '2026-10-18T09:48:00Z',
  },
]
