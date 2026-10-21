import type { MonitoringSnapshot, TimeRange } from '../types'

const contracts: MonitoringSnapshot['contracts'] = [
  { id: 'vault', name: 'Vault', address: '0x3f2a000000000000000000000000000000009c1d', network: 'Sepolia', status: 'active' },
  { id: 'token-factory', name: 'TokenFactory', address: '0x7b6e000000000000000000000000000000002d44', network: 'Sepolia', status: 'active' },
  { id: 'treasury', name: 'Treasury', address: '0x8d1100000000000000000000000000000000006f02', network: 'Sepolia', status: 'active' },
]
const deposits = [18, 34, 49, 64, 79, 32, 47, 62, 77, 30, 45, 60, 75, 28, 43, 58, 73, 26, 41, 56, 71, 24, 39, 54]
const transfers = [13, 39, 65, 91, 35, 61, 87, 31, 57, 83, 27, 53, 79, 22, 48, 74, 18, 44, 70, 96, 39, 65, 91, 35]
const withdrawals = [9, 19, 29, 39, 49, 9, 19, 29, 39, 49, 9, 19, 29, 39, 49, 9, 19, 29, 39, 49, 9, 19, 29, 39]

function snapshot(range: TimeRange): MonitoringSnapshot {
  const scale = range === '1h' ? 0.45 : range === '7d' ? 1.4 : 1
  const count = range === '1h' ? 3 : range === '7d' ? 9 : 6
  return {
    eventRate: range === '1h' ? 28 : range === '7d' ? 57 : 42,
    lastBlock: 7842311,
    lagSeconds: 3.2,
    contracts,
    throughput: Array.from({ length: range === '1h' ? 30 : range === '7d' ? 28 : 24 }, (_, i) => ({
      label: range === '1h' ? `${String(i * 2).padStart(2, '0')} min` : range === '7d' ? `Day ${Math.floor(i / 4) + 1}, ${String(i % 4 * 6).padStart(2, '0')}:00` : `${String(i).padStart(2, '0')}:00`,
      deposit: Math.round(deposits[i % 24] * scale), transfer: Math.round(transfers[i % 24] * scale), withdrawal: Math.round(withdrawals[i % 24] * scale),
    })),
    events: Array.from({ length: count }, (_, i) => ({
      id: `${range}-event-${i}`, contractId: contracts[i % 3].id,
      name: (['Deposit', 'Transfer', 'Withdrawal'] as const)[i % 3], block: 7842311 - i * 6,
      timestamp: new Date(Date.UTC(2026, 9, 20, 12, 0) - i * (range === '1h' ? 180000 : range === '7d' ? 64800000 : 3600000)).toISOString(),
    })),
    alerts: [
      { id: 'decode', contractId: 'vault', message: 'Log decode failed', status: 'Error' },
      { id: 'rpc', contractId: 'token-factory', message: 'RPC timeout', status: 'Retrying' },
      { id: 'reorg', contractId: 'vault', message: 'Reorg detected', status: 'Recovered' },
      { id: 'limit', contractId: 'treasury', message: 'Rate limit', status: 'Retrying' },
    ].slice(0, range === '1h' ? 2 : 4) as MonitoringSnapshot['alerts'],
  }
}

export const monitoringFixtures: Record<TimeRange, MonitoringSnapshot> = {
  '1h': snapshot('1h'), '24h': snapshot('24h'), '7d': snapshot('7d'),
}
