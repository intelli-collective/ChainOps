import { useMemo, useState } from 'react'
import { MonitoringDashboard } from '../pages/MonitoringDashboard'
import { ContractEventsExplorer } from '../pages/ContractEventsExplorer'
import { createMockMonitoringService } from '../services/monitoringService'
import { createMockEventsService } from '../events/service'
import type { MockScenario } from '../types'

export function MonitoringPreview() {
  const [scenario, setScenario] = useState<MockScenario>('success')
  const [page, setPage] = useState<'dashboard' | 'events'>('dashboard')
  const [contractId, setContractId] = useState<string>()
  const service = useMemo(() => createMockMonitoringService(scenario), [scenario])
  const eventsService = useMemo(() => createMockEventsService(scenario), [scenario])
  return <>
    <aside className="preview-controls" aria-label="Development preview controls">
      <span>M3 · Monitoring feature preview</span>
      <label>Page<select value={page} onChange={event => { setPage(event.target.value as 'dashboard' | 'events'); setContractId(undefined) }}><option value="dashboard">Dashboard</option><option value="events">Events Explorer</option></select></label>
      <label>Data state<select value={scenario} onChange={(event) => setScenario(event.target.value as MockScenario)}><option value="success">Success</option><option value="empty">Empty</option><option value="error">Error</option></select></label>
      <a href="/">Back to app</a>
    </aside>
    {page === 'dashboard' ? <MonitoringDashboard key={scenario} projectId="chainvault" service={service} onOpenEventExplorer={path => { setContractId(decodeURIComponent(path.split('/').at(-2) ?? '')); setPage('events') }} /> : <ContractEventsExplorer key={`${scenario}-${contractId ?? 'all'}`} projectId="chainvault" contractId={contractId} service={eventsService} onBackToMonitoring={() => setPage('dashboard')} />}
  </>
}
