import type { EventFilters, ExplorerEvent } from './types'

export function validateEventFilters(filters: EventFilters): string | null {
  if (filters.from && !Number.isFinite(Date.parse(`${filters.from}Z`))) return 'Enter a valid From date in UTC.'
  if (filters.to && !Number.isFinite(Date.parse(`${filters.to}Z`))) return 'Enter a valid To date in UTC.'
  if (filters.from && filters.to && filters.from > filters.to) return 'From (UTC) must be earlier than or equal to To (UTC).'
  for (const value of [filters.minBlock, filters.maxBlock]) {
    if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return 'Block numbers must be non-negative whole numbers within the safe integer range.'
  }
  if (filters.minBlock && filters.maxBlock && Number(filters.minBlock) > Number(filters.maxBlock)) return 'Minimum block must be less than or equal to maximum block.'
  return null
}

export function filterEvents(events: ExplorerEvent[], filters: EventFilters): ExplorerEvent[] {
  const start = filters.from ? Date.parse(`${filters.from}Z`) : -Infinity
  // A minute-precision To input includes the entire selected minute.
  const end = filters.to ? Date.parse(`${filters.to}Z`) + 59999 : Infinity
  return events.filter(event =>
    (!filters.contractId || event.contractId === filters.contractId) &&
    (!filters.eventType || event.name === filters.eventType) &&
    Date.parse(event.timestamp) >= start && Date.parse(event.timestamp) <= end &&
    (!filters.minBlock || event.block >= Number(filters.minBlock)) &&
    (!filters.maxBlock || event.block <= Number(filters.maxBlock)),
  ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

export function eventsToCsv(events: ExplorerEvent[], contractNames: Record<string, string>): string {
  const cell = (value: string | number) => {
    const text = String(value)
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  const rows = [
    ['Time (UTC)', 'Event', 'Contract', 'Transaction Hash', 'Block', 'Log Index', 'Decoded Parameters', 'Data Source'],
    ...events.map(event => [event.timestamp, event.name, contractNames[event.contractId] ?? event.contractId, event.transactionHash, event.block, event.logIndex, JSON.stringify(event.parameters), 'Mock fixture']),
  ]
  return rows.map(row => row.map(cell).join(',')).join('\r\n')
}
