import { Fragment, useEffect, useId, useState } from 'react'
import { eventsToCsv, filterEvents, validateEventFilters } from '../events/filterEvents'
import { mockEventsService } from '../events/service'
import type { EventsService } from '../events/service'
import type { EventFilters, EventsSnapshot } from '../events/types'
import '../monitoring.css'
import '../events/events.css'

interface ContractEventsExplorerProps {
  projectId: string
  contractId?: string
  service?: EventsService
  onBackToMonitoring?: () => void
}
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: EventsSnapshot }
const initialFilters = (contractId = ''): EventFilters => ({ contractId, eventType: '', from: '2026-10-26T00:00', to: '2026-10-26T23:59', minBlock: '', maxBlock: '' })
const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-6)}`
const formatTime = (timestamp: string) => new Date(timestamp).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const PAGE_SIZE = 10

export function ContractEventsExplorer(props: ContractEventsExplorerProps) {
  return <EventsExplorerContent key={`${props.projectId}:${props.contractId ?? 'all'}`} {...props} />
}

function EventsExplorerContent({ projectId, contractId, service = mockEventsService, onBackToMonitoring }: ContractEventsExplorerProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [filters, setFilters] = useState(() => initialFilters(contractId))
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [live, setLive] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const errorId = useId()

  useEffect(() => {
    let active = true
    service.getEvents(projectId).then(
      data => { if (active) setState({ status: 'success', data }) },
      (error: unknown) => { if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load events.' }) },
    )
    return () => { active = false }
  }, [projectId, service, attempt])
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setAttempt(value => value + 1), 15000)
    return () => window.clearInterval(timer)
  }, [live])

  const data = state.status === 'success' ? state.data : null
  const validationError = validateEventFilters(filters)
  const unknownContract = Boolean(data && filters.contractId && !data.contracts.some(contract => contract.id === filters.contractId))
  const filtered = data && !validationError ? filterEvents(data.events, filters) : []
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const contractNames = Object.fromEntries(data?.contracts.map(contract => [contract.id, contract.name]) ?? [])
  const updateFilter = (name: keyof EventFilters, value: string) => {
    setFilters(previous => ({ ...previous, [name]: value }))
    setPage(1); setExpanded([]); setExportMessage('')
  }
  const clear = () => { setFilters({ contractId: '', eventType: '', from: '', to: '', minBlock: '', maxBlock: '' }); setPage(1); setExpanded([]); setExportMessage('') }
  const retry = () => { setState({ status: 'loading' }); setAttempt(value => value + 1) }
  const exportCsv = () => {
    const blob = new Blob(['\uFEFF', eventsToCsv(filtered, contractNames)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'chainops-mock-contract-events.csv'
    document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportMessage(`Exported ${filtered.length} matching mock events.`)
  }

  return <main className="monitoring events-explorer" aria-labelledby="events-title">
    <p className="monitoring-breadcrumb">Operate <span aria-hidden="true">›</span>{onBackToMonitoring ? <button type="button" onClick={onBackToMonitoring}>Monitoring</button> : 'Monitoring'}</p>
    <div className="monitoring-title-row">
      <h1 id="events-title">Contract Events</h1>
      <div className="events-actions">
        <button type="button" className="events-outline" onClick={exportCsv} disabled={!filtered.length || Boolean(validationError)}>Export CSV</button>
        <button type="button" className="events-outline events-live" aria-pressed={live} onClick={() => setLive(value => !value)}>{live ? '● Live · mock' : 'Ⅱ Paused · mock'}</button>
      </div>
    </div>
    <p className="events-subtitle">Browse decoded events from monitored contracts.</p>
    <p className="monitoring-demo">Mock data · Sepolia Testnet · Sample date: 26 Oct 2026 · {live ? 'Refreshes the same mock snapshot every 15 seconds' : 'Automatic mock refresh paused'}</p>
    <div className="events-filters" aria-label="Event filters">
      <label>Contract<select value={filters.contractId} onChange={event => updateFilter('contractId', event.target.value)}>
        <option value="">All contracts</option>
        {unknownContract && <option value={filters.contractId}>Unknown contract ({filters.contractId})</option>}
        {!data && contractId && <option value={contractId}>{contractId}</option>}
        {data?.contracts.map(contract => <option key={contract.id} value={contract.id}>{contract.name}</option>)}
      </select></label>
      <label>Event type<select value={filters.eventType} onChange={event => updateFilter('eventType', event.target.value)}><option value="">All events</option><option>Transfer</option><option>Deposit</option><option>Withdrawal</option></select></label>
      <label>From (UTC)<input type="datetime-local" value={filters.from} onChange={event => updateFilter('from', event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? errorId : undefined} /></label>
      <label>To (UTC)<input type="datetime-local" value={filters.to} onChange={event => updateFilter('to', event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? errorId : undefined} /></label>
      <button type="button" className="events-outline" onClick={clear}>Clear</button>
    </div>
    <details className="events-block-filters"><summary>Block range</summary><div>
      <label>Minimum block<input inputMode="numeric" value={filters.minBlock} onChange={event => updateFilter('minBlock', event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? errorId : undefined} /></label>
      <label>Maximum block<input inputMode="numeric" value={filters.maxBlock} onChange={event => updateFilter('maxBlock', event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? errorId : undefined} /></label>
    </div></details>
    {validationError && <p className="events-validation" role="alert" id={errorId}>{validationError}</p>}
    {exportMessage && <p className="monitoring-notice" role="status">{exportMessage}</p>}
    {state.status === 'loading' && <section className="monitoring-card monitoring-state" role="status">Loading contract events…</section>}
    {state.status === 'error' && <section className="monitoring-card monitoring-state" role="alert"><h2>Events unavailable</h2><p>{state.message}</p><button type="button" className="monitoring-primary" onClick={retry}>Try again</button></section>}
    {data && !validationError && (unknownContract ? <section className="monitoring-card monitoring-state"><h2>Contract not found</h2><p>The selected contract is not available in this project’s mock data.</p><button type="button" onClick={clear}>Show all contracts</button></section> : !filtered.length ? <section className="monitoring-card monitoring-state"><h2>{data.events.length ? 'No matching events' : 'No indexed events'}</h2><p>{data.events.length ? 'Try another contract, event type, date, or block range.' : 'Events will appear here when mock records are available.'}</p><button type="button" onClick={data.events.length ? clear : retry}>{data.events.length ? 'Clear filters' : 'Refresh events'}</button></section> : <>
      <div className="monitoring-card events-table-wrap" role="region" aria-label="Contract event results, horizontally scrollable on small screens" tabIndex={0}>
        <table className="events-table"><caption className="events-sr-only">Mock decoded contract events. All timestamps are UTC.</caption><thead><tr><th scope="col">Time (UTC)</th><th scope="col">Event</th><th scope="col">Contract</th><th scope="col">Transaction Hash</th><th scope="col">Block</th><th scope="col">Details</th></tr></thead><tbody>
          {rows.map(event => <Fragment key={event.id}>
            <tr><td><time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time></td><td className="events-accent">{event.name}</td><td>{contractNames[event.contractId]}</td><td><code title={event.transactionHash}>{shortHash(event.transactionHash)}</code></td><td><button type="button" className="events-text-button" aria-label={`Inspect block ${event.block} for ${event.name}`} onClick={() => setExpanded(previous => previous.includes(event.id) ? previous : [...previous, event.id])}>{event.block.toLocaleString('en-US')}</button></td><td><button type="button" className="events-text-button" aria-expanded={expanded.includes(event.id)} aria-controls={`${errorId}-${event.id}`} aria-label={`${expanded.includes(event.id) ? 'Hide' : 'View'} ${event.name} details at block ${event.block}`} onClick={() => setExpanded(previous => previous.includes(event.id) ? previous.filter(id => id !== event.id) : [...previous, event.id])}>{expanded.includes(event.id) ? 'Hide ↑' : 'View →'}</button></td></tr>
            {expanded.includes(event.id) && <tr id={`${errorId}-${event.id}`} className="events-detail-row"><td colSpan={6}>
              <h2>{event.name} · Decoded parameters</h2><dl><dt>Transaction hash</dt><dd><code>{event.transactionHash}</code></dd><dt>Block</dt><dd>{event.block.toLocaleString('en-US')}</dd><dt>Log index</dt><dd>{event.logIndex}</dd><dt>Contract / Network</dt><dd>{contractNames[event.contractId]} / Sepolia</dd><dt>Timestamp (UTC)</dt><dd>{event.timestamp}</dd></dl>
              <ul>{event.parameters.map(parameter => <li key={parameter.name}><strong>{parameter.name}</strong><span>{parameter.type}</span><code>{parameter.value}</code></li>)}</ul>
              <p className="monitoring-muted">Synthetic sample transaction and decoded values. Amounts are raw integers.</p>
            </td></tr>}
          </Fragment>)}
        </tbody></table>
      </div>
      <div className="events-pagination"><p aria-live="polite">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} matching mock events{filtered.length !== data.events.length ? ` (${data.events.length} total)` : ''}</p><nav aria-label="Event pagination"><button type="button" className="events-outline" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setExpanded([]) }}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" className="events-outline" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setExpanded([]) }}>Next</button></nav></div>
    </>)}
  </main>
}
