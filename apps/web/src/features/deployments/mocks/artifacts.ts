import type { BuildArtifact } from '../types/deployment'

export const buildArtifacts: BuildArtifact[] = [
  { id: 'vault-128', releaseId: 'vault-v1-4', contractName: 'Vault', source: 'contracts/Vault.sol', compiler: 'Solidity 0.8.24' },
  { id: 'vault-124', releaseId: 'vault-v1-3', contractName: 'Vault', source: 'contracts/Vault.sol', compiler: 'Solidity 0.8.24' },
]
