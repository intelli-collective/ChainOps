import { useEffect, useState } from 'react'
import { MonitoringDialog } from '../components/MonitoringDialog'
import { mockMonitoringService } from '../services/monitoringService'
import type { MonitoringService } from '../services/monitoringService'
import type { MonitoringSnapshot, TimeRange } from '../types'
import '../monitoring.css'

interface MonitoringDashboardProps {
  projectId: string
  service?: MonitoringService
  /** M5 can supply React Router navigation once the explorer route is registered. */
  onOpenEventExplorer?: (path: string) => void
}
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: MonitoringSnapshot }
const rangeNames: Record<TimeRange, string> = { '1h': 'past hour', '24h': 'past 24 hours', '7d': 'past 7 days' }
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export function MonitoringDashboard({ projectId, service = mockMonitoringService, onOpenEventExplorer }: MonitoringDashboardProps) {
  const [range, setRange] = useState<TimeRange>('24h')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState<'watchers' | 'contracts' | 'alerts' | 'events' | null>(null)
  const [contractId, setContractId] = useState<string | null>(null)
  const [paused, setPaused] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    service.getOverview(projectId, range).then(
      (data) => { if (active) setState({ status: 'success', data }) },
      (error: unknown) => { if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load monitoring.' }) },
    )
    return () => { active = false }
  }, [projectId, range, service, attempt])

  const data = state.status === 'success' ? state.data : null
  const selectedContract = data?.contracts.find((contract) => contract.id === contractId)
  const events = data?.events.filter((event) => !contractId || event.contractId === contractId) ?? []
  const contractName = (id: string) => data?.contracts.find((contract) => contract.id === id)?.name ?? id
  const openEvents = (id: string | null) => { setContractId(id); setDialog('events') }
  const eventPath = (id: string) => `/projects/${encodeURIComponent(projectId)}/monitoring/contracts/${encodeURIComponent(id)}/events`
  const reload = () => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }

  return <main className="monitoring" aria-labelledby="monitoring-title">
    <p className="monitoring-breadcrumb">Operate <span aria-hidden="true">›</span> Monitoring</p>
    <div className="monitoring-title-row">
      <h1 id="monitoring-title">Monitoring Overview</h1>
      <button className="monitoring-primary" type="button" disabled={!data?.contracts.length} onClick={() => { setSaved(false); setDialog('watchers') }}>Configure Watchers</button>
    </div>
    <div className="monitoring-intro">
      <p>Visibility into contract activity, indexed events and watcher health.</p>
      <label>Time range <select value={range} onChange={(event) => { setState({ status: 'loading' }); setRange(event.target.value as TimeRange) }}>
        <option value="1h">Past hour</option><option value="24h">Past 24 hours</option><option value="7d">Past 7 days</option>
      </select></label>
    </div>
    <p className="monitoring-demo">Mock data · Sepolia Testnet · Snapshot: 20 Oct 2026, 12:00 UTC</p>
    {saved && <p className="monitoring-notice" role="status">Watcher preferences saved for this preview session.</p>}
    {state.status === 'loading' && <section className="monitoring-card monitoring-state" role="status" aria-live="polite">Loading monitoring overview…</section>}
    {state.status === 'error' && <section className="monitoring-card monitoring-state" role="alert"><h2>Monitoring unavailable</h2><p>{state.message}</p><button type="button" className="monitoring-primary" onClick={reload}>Try again</button></section>}
    {data && !data.contracts.length && <section className="monitoring-card monitoring-state"><h2>No monitored contracts</h2><p>Monitored contracts and their activity will appear here when they are available.</p><button type="button" onClick={reload}>Refresh overview</button></section>}
    {data && data.contracts.length > 0 && <>
      <section className="monitoring-stats" aria-label="Monitoring summary">
        <article className="monitoring-card"><h2>Watcher Status</h2><strong>{paused.length === data.contracts.length ? 'Paused' : paused.length ? 'Partial' : 'Healthy'}</strong><p className="monitoring-good">{paused.length ? `${data.contracts.length - paused.length} of ${data.contracts.length} watchers active` : 'Connected to Sepolia'}</p></article>
        <article className="monitoring-card"><h2>Event Rate</h2><strong>{data.eventRate} events/min</strong><p>{rangeNames[range]} · Mock average</p></article>
        <article className="monitoring-card"><h2>Last Indexed Block</h2><strong>{data.lastBlock.toLocaleString('en-US')}</strong><p>{data.lagSeconds}s behind head · Synced snapshot</p></article>
      </section>
      <section className="monitoring-card monitoring-throughput" aria-labelledby="throughput-title">
        <div className="monitoring-section-heading"><h2 id="throughput-title">Event Throughput ({rangeNames[range]})</h2><div className="monitoring-legend"><span>Deposit</span><span>Transfer</span><span>Withdrawal</span></div></div>
        <p>Events · 0 to 150</p>
        <div className="monitoring-chart" role="img" aria-label={`Mock event throughput for the ${rangeNames[range]}. A data table follows.`}>
          {data.throughput.map((bucket, index) => <div className="monitoring-bar-group" key={index}>
            <span style={{ height: `${bucket.deposit / 1.5}%` }} /><span style={{ height: `${bucket.transfer / 1.5}%` }} /><span style={{ height: `${bucket.withdrawal / 1.5}%` }} />
          </div>)}
        </div>
        <div className="monitoring-chart-axis" aria-hidden="true">{(range === '24h' ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'] : range === '1h' ? ['0 min', '10 min', '20 min', '30 min', '40 min', '50 min', '60 min'] : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']).map((label) => <span key={label}>{label}</span>)}</div>
        <details className="monitoring-chart-data"><summary>View chart data</summary><div className="monitoring-table-wrap"><table><caption>Mock throughput by time bucket</caption><thead><tr><th>Time</th><th>Deposit</th><th>Transfer</th><th>Withdrawal</th></tr></thead><tbody>{data.throughput.map((bucket, index) => <tr key={index}><th>{bucket.label}</th><td>{bucket.deposit}</td><td>{bucket.transfer}</td><td>{bucket.withdrawal}</td></tr>)}</tbody></table></div></details>
      </section>
      <div className="monitoring-panels">
        <section className="monitoring-card"><div className="monitoring-section-heading"><h2>Monitored Contracts ({data.contracts.length})</h2><button type="button" onClick={() => setDialog('contracts')}>View all →</button></div>
          <ul className="monitoring-contracts">{data.contracts.map((contract) => <li key={contract.id}><button type="button" className="monitoring-contract-row" onClick={() => openEvents(contract.id)} aria-label={`Inspect ${contract.name} events`}><span>{contract.name}</span><span title={contract.address}>{shortAddress(contract.address)}</span><span className="monitoring-active">● {paused.includes(contract.id) ? 'Paused' : 'Active'}</span></button></li>)}</ul>
        </section>
        <section className="monitoring-card"><div className="monitoring-section-heading"><h2>Recent Failures ({data.alerts.length})</h2><button type="button" onClick={() => setDialog('alerts')}>View all →</button></div>
          <ul className="monitoring-alerts">{data.alerts.map((alert) => <li key={alert.id}><span>{contractName(alert.contractId)}</span><span>{alert.message}</span><span className={`monitoring-status-${alert.status.toLowerCase()}`}>{alert.status}</span></li>)}</ul>
        </section>
      </div>
      <button className="monitoring-primary monitoring-browse" type="button" onClick={() => openEvents(null)}>Browse contract events</button>
      <section className="monitoring-card monitoring-latest"><div className="monitoring-section-heading"><h2>Latest Events</h2><span className="monitoring-muted">{rangeNames[range]}</span></div><ul className="monitoring-events">{data.events.slice(0, 3).map((event) => <li key={event.id}><button type="button" onClick={() => openEvents(event.contractId)}>{contractName(event.contractId)} · {event.name}</button><span>Block {event.block.toLocaleString('en-US')}</span><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time></li>)}</ul></section>
    </>}
    {dialog && data && <MonitoringDialog title={dialog === 'watchers' ? 'Configure Watchers' : dialog === 'contracts' ? 'Monitored Contracts' : dialog === 'alerts' ? 'Recent Alert Summaries' : `${selectedContract?.name ?? 'All contracts'} · Latest Events`} onClose={() => setDialog(null)}>
      {dialog === 'watchers' && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setPaused(data.contracts.filter((contract) => !form.has(contract.id)).map((contract) => contract.id)); setSaved(true); setDialog(null) }}><p>Enable watchers in this mock preview. Preferences stay in memory; no live monitoring is changed.</p><fieldset><legend>Sepolia contract watchers</legend>{data.contracts.map((contract) => <label className="monitoring-check" key={contract.id}><input type="checkbox" name={contract.id} defaultChecked={!paused.includes(contract.id)} />{contract.name}<span>{shortAddress(contract.address)}</span></label>)}</fieldset><button className="monitoring-primary" type="submit">Save preview preferences</button></form>}
      {dialog === 'contracts' && <ul className="monitoring-dialog-list">{data.contracts.map((contract) => <li key={contract.id}><button type="button" onClick={() => openEvents(contract.id)}>{contract.name} →</button><p>{contract.network} · {paused.includes(contract.id) ? 'Paused' : 'Active'}</p><code>{contract.address}</code></li>)}</ul>}
      {dialog === 'alerts' && <ul className="monitoring-dialog-list">{data.alerts.map((alert) => <li key={alert.id}><strong>{contractName(alert.contractId)}</strong><p>{alert.message} · <span className={`monitoring-status-${alert.status.toLowerCase()}`}>{alert.status}</span></p><button type="button" onClick={() => openEvents(alert.contractId)}>Inspect contract events →</button></li>)}</ul>}
      {dialog === 'events' && <><p>Mock events · {rangeNames[range]} · Sepolia</p><label>Contract <select value={contractId ?? ''} onChange={(event) => setContractId(event.target.value || null)}><option value="">All contracts</option>{data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}</select></label><ul className="monitoring-dialog-list">{events.map((event) => <li key={event.id}><strong>{contractName(event.contractId)} · {event.name}</strong><p>Block {event.block.toLocaleString('en-US')}</p><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time></li>)}</ul>{events.length === 0 && <p>No events for this contract in the selected range.</p>}
        {onOpenEventExplorer && selectedContract ? <button className="monitoring-primary" type="button" onClick={() => onOpenEventExplorer(eventPath(selectedContract.id))}>Open Events Explorer →</button> : <p className="monitoring-muted">Events Explorer navigation will be connected with Task 2 and the shared router.</p>}
      </>}
    </MonitoringDialog>}
  </main>
}
