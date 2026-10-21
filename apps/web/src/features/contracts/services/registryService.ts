import { mockContracts } from '../mocks/contracts'
import type { ContractRecord, ContractRegistryService } from '../types'

let sessionContracts: ContractRecord[] = structuredClone(mockContracts)

/** In-memory preview data. Reloading the page resets registrations. */
export const mockRegistryService: ContractRegistryService = {
  async getContracts(projectId) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return structuredClone(sessionContracts.filter((contract) => contract.projectId === projectId))
  },
  async registerExistingContract(input) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    const address = input.address.trim()
    const transactionHash = input.transactionHash.trim()
    if (!input.projectId || !input.name.trim() || !input.version.trim() || !input.network.trim() || !/^0x[a-f\d]{40}$/i.test(address) || !/^0x[a-f\d]{64}$/i.test(transactionHash)) {
      throw new Error('Enter valid contract details.')
    }
    if (sessionContracts.some((contract) => contract.projectId === input.projectId && contract.network.toLowerCase() === input.network.toLowerCase() && contract.address.toLowerCase() === address.toLowerCase())) {
      throw new Error('This address is already registered on that network.')
    }
    const record: ContractRecord = {
      id: crypto.randomUUID(), projectId: input.projectId, name: input.name.trim(),
      version: input.version.trim(), address, network: input.network.trim(),
      monitoring: 'Paused', status: 'Active', transactionHash,
      deployedAt: new Date().toISOString(),
    }
    sessionContracts = [record, ...sessionContracts]
    return structuredClone(record)
  },
}
