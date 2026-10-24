import type { ApprovedRelease } from '../types/deployment'

export const approvedReleases: ApprovedRelease[] = [
  {
    id: 'vault-v1-4',
    projectId: 'chainvault',
    name: 'Vault v1.4',
    commitSha: 'a3f9c2e',
    runNumber: 128,
    buildPassed: true,
    approvals: 2,
    requiredApprovals: 2,
    allowedNetworks: ['Sepolia Testnet'],
  },
  {
    id: 'vault-v1-3',
    projectId: 'chainvault',
    name: 'Vault v1.3',
    commitSha: 'b7e1d4f',
    runNumber: 124,
    buildPassed: true,
    approvals: 2,
    requiredApprovals: 2,
    allowedNetworks: ['Sepolia Testnet'],
  },
]
