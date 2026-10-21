/// <reference types="node" />
import assert from 'node:assert/strict'
import { mockRegistryService } from './services/registryService'

const service = mockRegistryService
const initial = await service.getContracts('chainvault')
assert.deepEqual(initial.map((item) => item.name), ['Vault', 'TokenFactory', 'Treasury'])
assert.ok(initial.every((item) => /^0x[a-f\d]{40}$/i.test(item.address)))
assert.ok(initial.every((item) => /^0x[a-f\d]{64}$/i.test(item.transactionHash)))
assert.deepEqual(await service.getContracts('another-project'), [])

const input = {
  projectId: 'chainvault', name: 'Registry Test', version: 'v2',
  address: `0x${'1'.repeat(40)}`, network: 'Ethereum Mainnet',
  transactionHash: `0x${'2'.repeat(64)}`,
}
const added = await service.registerExistingContract(input)
assert.equal(added.status, 'Active')
assert.equal(added.monitoring, 'Paused')
assert.equal((await service.getContracts('chainvault')).length, initial.length + 1)
assert.equal((await service.getContracts('another-project')).length, 0)
await assert.rejects(service.registerExistingContract(input), /already registered/)
await assert.rejects(service.registerExistingContract({ ...input, address: '0xbad' }))
await assert.rejects(service.registerExistingContract({ ...input, transactionHash: '0xbad' }))
await assert.rejects(service.registerExistingContract({ ...input, name: ' ' }))

console.log('Registry checks passed: fixture metadata, project isolation, registration, duplicate prevention, and field validation.')
