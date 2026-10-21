import { useEffect, useState } from 'react'
import { FindingTable } from '../components/FindingTable'
import { countSeverities, emptyFilters, filterFindings, findingStatusLabels, formatScanDate, policyLabels, scanDetailsPath, severityLabels } from '../securityUtils'
import type { SecurityScan, SecurityService } from '../types/security'
import './security.css'

export interface SecurityDashboardProps {
  projectId: string
  service: SecurityService
  /** M5 supplies React Router's navigate; no competing feature router. */
  onNavigate: (path: string) => void
  /** M5 may navigate to the future Analysis Complete screen after a successful run. */
  onAnalysisComplete?: (scan: SecurityScan) => void
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; scans: SecurityScan[] }

export function SecurityDashboard(props: SecurityDashboardProps) {
  // A project switch must discard selection, filters, and pending work together.
  return <SecurityDashboardContent key={props.projectId} {...props} />
}

function SecurityDashboardContent({ projectId, service, onNavigate, onAnalysisComplete }: SecurityDashboardProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [reload, setReload] = useState(0)
  const [runController, setRunController] = useState<AbortController | null>(null)
  const [runMessage, setRunMessage] = useState('')
  const [runError, setRunError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    service.listScans(projectId, controller.signal).then(scans => {
      if (!controller.signal.aborted) setState({ status: 'ready', scans })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load security scans.' })
    })
    return () => controller.abort()
  }, [projectId, service, reload])

  useEffect(() => () => runController?.abort(), [runController])

  const scans = state.status === 'ready' ? state.scans : []
  const scan = scans.find(item => item.id === selectedId) ?? scans[0]
  const counts = countSeverities(scan?.findings ?? [])
  const filtered = filterFindings(scan?.findings ?? [], filters)
  const isRunning = runController !== null || scan?.status === 'running'
  const hasResults = scan?.status === 'completed' && !runController

  function openDetails(findingId?: string) {
    if (scan) onNavigate(scanDetailsPath(projectId, scan.id) + (findingId ? `#${encodeURIComponent(findingId)}` : ''))
  }

  async function runAnalysis() {
    if (isRunning) return
    const controller = new AbortController()
    setRunController(controller)
    setRunError('')
    setRunMessage('Analysis in progress…')
    try {
      const result = await service.runAnalysis(projectId, controller.signal)
      if (controller.signal.aborted) return
      setState(previous => ({ status: 'ready', scans: [result, ...(previous.status === 'ready' ? previous.scans.filter(item => item.id !== result.id) : [])] }))
      setSelectedId(result.id)
      setFilters(emptyFilters)
      setRunMessage('Analysis completed.')
      onAnalysisComplete?.(result)
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setRunError(error instanceof Error ? error.message : 'Unable to run analysis.')
        setRunMessage('')
      }
    } finally {
      if (!controller.signal.aborted) setRunController(null)
    }
  }

  return (
    <section className="security-dashboard" aria-labelledby="security-title">
      <p className="security-breadcrumb">Security &nbsp;›&nbsp; Security Findings</p>
      <div className="security-heading">
        <h1 id="security-title">Security Findings</h1>
        <button className="security-primary" disabled={state.status !== 'ready' || isRunning} onClick={() => void runAnalysis()}>{isRunning ? 'Analysis running…' : 'Run Analysis →'}</button>
      </div>
      <p className="security-description">Automated static analysis with Slither. Review and fix issues before release.</p>

      {state.status === 'loading' && <div className="security-state" role="status">Loading security scans…</div>}
      {state.status === 'error' && <div className="security-state" role="alert"><h2>Unable to load security scans</h2><p>{state.message}</p><button onClick={() => { setState({ status: 'loading' }); setReload(value => value + 1) }}>Retry</button></div>}
      {state.status === 'ready' && !scan && <div className="security-state" role="status"><h2>No security scans yet</h2><p>Run an analysis to see findings for this project.</p></div>}

      {scan && <>
        <div className="security-summary" aria-label="Finding severity counts">
          {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
            <div className="security-summary-card" key={severity}>
              <p className={`security-tone-${severity}`}><strong>{severityLabels[severity]} <span>{hasResults ? counts[severity] : '—'}</span></strong></p>
              <p>{!hasResults ? 'Results unavailable' : severity === 'critical' ? counts.critical ? 'Critical issues' : 'No critical issues' : severity === 'high' ? 'Blocks release' : severity === 'medium' ? 'Needs review' : 'Informational'}</p>
            </div>
          ))}
        </div>
        <div className="security-scan-context" aria-label="Scan history and policy result">
          <label className="security-history">Scan history
            <select aria-label="Scan history" value={scan.id} disabled={runController !== null} onChange={event => { setSelectedId(event.target.value); setFilters(emptyFilters); setRunMessage(''); setRunError('') }}>
              {scans.map((item, index) => <option key={item.id} value={item.id}>{index === 0 ? 'Latest · ' : ''}Analysis #{item.number} · {formatScanDate(item.startedAt)} · {item.id}</option>)}
            </select>
          </label>
          <p>Scan status <strong className={`security-tone-${isRunning ? 'running' : scan.status}`}>{isRunning ? 'Running' : scan.status === 'completed' ? 'Completed' : 'Failed'}</strong></p>
          <p>Policy result <strong className={`security-tone-${hasResults && scan.policy ? scan.policy.decision : 'unavailable'}`}>{hasResults && scan.policy ? policyLabels[scan.policy.decision] : 'Not evaluated'}</strong></p>
          <p>Informational <strong>{hasResults ? counts.informational : '—'}</strong></p>
          <button className="security-text-button" onClick={() => openDetails()}>View scan →</button>
          {hasResults && scan.policy && <p className="security-policy-reason">{scan.policy.reason}</p>}
        </div>
        {isRunning ? <div className="security-state" role="status">Analysis is running. Findings and policy results are not available yet.</div>
          : scan.status === 'failed' ? <div className="security-state" role="alert"><h2>Scan failed</h2><p>{scan.error ?? 'The analyzer did not complete.'}</p><p>No policy decision is available for this scan.</p></div>
          : <>
            <div className="security-filters" role="group" aria-label="Filter findings">
              <input type="search" aria-label="Search findings" placeholder="Search findings…" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} />
              <select aria-label="Finding severity" value={filters.severity} onChange={event => setFilters({ ...filters, severity: event.target.value })}><option value="">All severities</option>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{value === 'high' ? 'High severity' : label}</option>)}</select>
              <select aria-label="Finding status" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{Object.entries(findingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select aria-label="Contract" value={filters.contract} onChange={event => setFilters({ ...filters, contract: event.target.value })}><option value="">All contracts</option>{[...new Set(scan.findings.map(finding => finding.contract))].sort().map(contract => <option key={contract}>{contract}</option>)}</select>
              <button onClick={() => setFilters(emptyFilters)}>Clear</button>
            </div>
            {scan.findings.length === 0 ? <div className="security-state" role="status"><h2>No findings</h2><p>This completed scan returned no findings. Review the separate policy result above.</p></div>
              : filtered.length === 0 ? <div className="security-state" role="status"><h2>No matching findings</h2><p>Try another search or clear the filters.</p><button onClick={() => setFilters(emptyFilters)}>Clear filters</button></div>
                : <FindingTable findings={filtered} pipelineRunId={scan.pipelineRunId} onOpenDetails={openDetails} />}
            <p className="security-footer" role="status">{filters.severity === 'high' && !filters.search && !filters.status && !filters.contract
              ? `Showing ${filtered.length} high-severity finding${filtered.length === 1 ? '' : 's'}`
              : `Showing ${filtered.length} of ${scan.findings.length} findings · Analysis #${scan.number} · ${scan.id === scans[0]?.id ? 'Latest revision' : 'Revision'} ${scan.commitSha}`}</p>
          </>}
      </>}
      {runMessage && <p role="status">{runMessage}</p>}
      {runError && <p role="alert" className="security-tone-failed">{runError}</p>}
    </section>
  )
}
