import { monitoringFixtures } from '../mocks/monitoring'
import type { EventsSnapshot, ExplorerEvent } from './types'

const times = ['15:24:11', '15:21:03', '15:18:16', '15:17:12', '15:14:24', '15:09:33', '15:05:21', '15:01:09', '14:56:17', '14:52:03']
const names = ['Transfer', 'Deposit', 'Withdrawal', 'Transfer', 'Deposit', 'Transfer', 'Withdrawal', 'Transfer', 'Deposit', 'Transfer'] as const
const contracts = monitoringFixtures['24h'].contracts
const blocks = [7842311, 7842307, 7842303, 7842300, 7842297, 7842290, 7842282, 7842276, 7842270, 7842263]
const hashPrefixes = ['6a3f', '8d22', '1c9b', 'a97e', '4e44', '67c7', 'd2a8', 'c71a', '5e8b', 'a7c9']
const hashSuffixes = ['0c9e1d', '4793a1', '7e3d2f', '2b6c11', '8d1f90', '3b72e0', 'c4e6ff', '9d3c5a', '7a1d0c', '3f2e68']

export const eventsFixture: EventsSnapshot = {
  contracts,
  events: Array.from({ length: 248 }, (_, i): ExplorerEvent => {
    const contract = i % 10 === 3 || i % 10 === 7 ? contracts[1] : i % 10 === 9 ? contracts[2] : contracts[0]
    const name = names[i % 10]
    const timestamp = i < 10 ? `2026-10-26T${times[i]}Z` : new Date(Date.parse('2026-10-26T14:50:00Z') - (i - 10) * 120000).toISOString()
    return {
      id: `sample-event-${i + 1}`, contractId: contract.id, name, timestamp,
      block: i < 10 ? blocks[i] : 7842260 - (i - 10) * 5,
      transactionHash: `0x${hashPrefixes[i % 10]}${(i + 1).toString(16).padStart(54, '0')}${hashSuffixes[i % 10]}`,
      logIndex: i % 4,
      parameters: name === 'Transfer' ? [
        { name: 'from', type: 'address', value: contracts[(i + 1) % 3].address },
        { name: 'to', type: 'address', value: contract.address },
        { name: 'value', type: 'uint256', value: String((i + 1) * 1000000) },
      ] : [
        { name: 'account', type: 'address', value: contract.address },
        { name: 'amount', type: 'uint256', value: String((i + 1) * 1000000) },
      ],
    }
  }),
}
