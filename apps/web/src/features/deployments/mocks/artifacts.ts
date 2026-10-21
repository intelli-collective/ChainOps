import type { BuildArtifact } from '../types/deployment'

export const buildArtifacts: BuildArtifact[] = [
  { id: 'vault-128', releaseId: 'vault-v1-4', contractName: 'Vault', source: 'contracts/Vault.sol', compiler: 'Solidity 0.8.24', fileName: 'Vault.json', sizeKb: 24.6 },
  { id: 'vault-factory-128', releaseId: 'vault-v1-4', contractName: 'VaultFactory', source: 'contracts/VaultFactory.sol', compiler: 'Solidity 0.8.24', fileName: 'VaultFactory.json', sizeKb: 12.1 },
  { id: 'mock-usdc-128', releaseId: 'vault-v1-4', contractName: 'MockUSDC', source: 'contracts/MockUSDC.sol', compiler: 'Solidity 0.8.24', fileName: 'MockUSDC.json', sizeKb: 9.8 },
  { id: 'vault-124', releaseId: 'vault-v1-3', contractName: 'Vault', source: 'contracts/Vault.sol', compiler: 'Solidity 0.8.24', fileName: 'Vault.json', sizeKb: 24.6 },
]
