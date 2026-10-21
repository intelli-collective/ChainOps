import { useEffect, useState } from 'react'
import { SecurityFindingDetailsView } from '../components/SecurityFindingDetailsView'
import { securityDashboardPath } from '../securityUtils'
import type { SecurityFindingLookup, SecurityService } from '../types/security'
import './security.css'

export interface SecurityFindingDetailsPageProps {
  projectId: string
  scanId: string
  /** Optional finding ID, for example from the encoded hash in Issue #26's finding link. */
  findingId?: string
  service: SecurityService
  onNavigate: (path: string) => void
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | SecurityFindingLookup

/** Mount inside M5's shared shell when it registers the scan-details route. */
export function SecurityFindingDetailsPage({ projectId, scanId, findingId, service, onNavigate }: SecurityFindingDetailsPageProps) {
  return <FindingDetailLookup key={`${projectId}:${scanId}:${findingId ?? ''}`} projectId={projectId} scanId={scanId} findingId={findingId} service={service} onNavigate={onNavigate} />
}

function FindingDetailLookup({ projectId, scanId, findingId, service, onNavigate }: SecurityFindingDetailsPageProps) {
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    service.getFindingDetail(projectId, scanId, findingId, controller.signal).then(
      result => { if (!controller.signal.aborted) setState(result) },
      error => {
        if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load this finding.' })
      },
    )
    return () => controller.abort()
  }, [projectId, scanId, findingId, service, attempt])

  if (state.status === 'found') {
    return <SecurityFindingDetailsView key={`${state.scan.id}:${state.finding.id}`} scan={state.scan} finding={state.finding} onNavigate={onNavigate} />
  }

  const title = state.status === 'loading' ? 'Loading finding' : state.status === 'error' ? 'Finding unavailable'
    : state.status === 'scan-not-found' ? 'Scan not found' : 'Finding not found'
  const message = state.status === 'error' ? state.message
    : state.status === 'scan-not-found' ? 'This scan could not be found for the selected project.'
      : state.status === 'finding-not-found' ? 'This scan has no matching finding.' : 'Retrieving scan and finding details…'

  return <section className="security-dashboard security-detail" aria-labelledby="security-finding-state-title">
    <nav className="security-detail-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={() => onNavigate(securityDashboardPath(projectId))}>Security</button>
      <span aria-hidden="true">›</span><span aria-current="page">{title}</span>
    </nav>
    <h1 id="security-finding-state-title">{title}</h1>
    <div className="security-state" role={state.status === 'error' ? 'alert' : 'status'}>
      <p>{message}</p>
      {state.status === 'error' && <button type="button" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1) }}>Retry</button>}
      {(state.status === 'scan-not-found' || state.status === 'finding-not-found') && <button type="button" onClick={() => onNavigate(securityDashboardPath(projectId))}>Back to Security Findings</button>}
    </div>
  </section>
}
