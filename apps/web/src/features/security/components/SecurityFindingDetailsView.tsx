import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { pipelineRunPath } from '../../pipelines'
import { findingStatusLabels, policyLabels, securityDashboardPath, severityLabels } from '../securityUtils'
import type { SecurityFinding, SecurityScan } from '../types/security'
import '../pages/security.css'

export interface SecurityFindingDetailsViewProps {
  scan: SecurityScan
  finding: SecurityFinding
  onNavigate: (path: string) => void
}

const tabs = ['overview', 'remediation', 'evidence'] as const
type DetailTab = typeof tabs[number]
const tabLabels: Record<DetailTab, string> = {
  overview: 'Overview', remediation: 'Remediation', evidence: 'Evidence',
}

function formatDetectedAt(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Colombo',
  }).format(new Date(timestamp))
}

function SourceCode({ finding, file }: { finding: SecurityFinding; file: string }) {
  return <section className="security-detail-source" aria-label={`Source code in ${file}`}>
    <h2>Source Code&nbsp; ({file})</h2>
    {finding.sourceContext ? (
      <div className="security-detail-code" role="region" aria-label="Affected source context" tabIndex={0}>
        {finding.sourceContext.lines.map(line => (
          <div className={`security-detail-source-line${line.number === finding.sourceContext?.highlightedLine ? ' security-detail-source-line-highlight' : ''}`} key={line.number}>
            <span className="security-detail-line-number">{line.number}</span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    ) : <p>Source context is unavailable for this finding.</p>}
  </section>
}

/** The Figma 27:517 found-finding view. */
export function SecurityFindingDetailsView({ scan, finding, onNavigate }: SecurityFindingDetailsViewProps) {
  const file = finding.sourceLocation?.file ?? finding.contract
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [acknowledged, setAcknowledged] = useState(finding.status === 'acknowledged')
  const tabId = useId()
  const displayedStatus = acknowledged ? 'acknowledged' : finding.status

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: DetailTab) {
    const index = tabs.indexOf(current)
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setActiveTab(tabs[next])
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <section className="security-dashboard security-detail" aria-labelledby="security-finding-title">
      <nav className="security-detail-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => onNavigate(securityDashboardPath(scan.projectId))}>Security</button>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{finding.title}</span>
      </nav>

      <div className="security-heading">
        <h1 id="security-finding-title">{finding.title}</h1>
        <button type="button" className="security-detail-acknowledge" disabled={finding.status !== 'open' || acknowledged} onClick={() => setAcknowledged(true)}>{acknowledged ? 'Acknowledged' : 'Acknowledge'}</button>
      </div>
      {acknowledged && finding.status !== 'acknowledged' && <p className="security-detail-local-note" role="status">Acknowledged for this view only. This change is not saved.</p>}
      <p className="security-description">
        {finding.id}{finding.detector ? ` detected by ${finding.detector}` : ''}
        {finding.description ? ` · ${finding.description}` : ''}
      </p>

      <div className="security-detail-meta" aria-label="Finding metadata">
        <p className={`security-detail-meta-primary security-tone-${finding.severity}`}>
          <span>{severityLabels[finding.severity]} severity</span>
          <span aria-hidden="true">·</span>
          <span>{findingStatusLabels[displayedStatus]}</span>
          <span aria-hidden="true">·</span>
          <span>{file}</span>
          {finding.sourceLocation && <><span aria-hidden="true">·</span><span>Line {finding.sourceLocation.line}</span></>}
        </p>
        <p className="security-detail-meta-secondary">
          <button type="button" className="security-detail-run-link" onClick={() => onNavigate(pipelineRunPath(scan.projectId, scan.pipelineRunId))}>Linked run #{scan.pipelineRunId}</button>
          <span aria-hidden="true">·</span>
          <span>Commit {scan.commitSha}</span>
          <span aria-hidden="true">·</span>
          <span>Detected <time dateTime={finding.detectedAt}>{formatDetectedAt(finding.detectedAt)}</time></span>
        </p>
      </div>

      <div className="security-detail-policy" aria-label="Release policy result">
        <span>Policy result</span>
        <strong className={`security-tone-${scan.status === 'completed' && scan.policy ? scan.policy.decision : 'unavailable'}`}>
          {scan.status === 'completed' && scan.policy ? policyLabels[scan.policy.decision] : 'Not evaluated'}
        </strong>
        {scan.status === 'completed' && scan.policy && <span>{scan.policy.reason}</span>}
      </div>

      <div className="security-detail-tabs" role="tablist" aria-label="Finding detail sections">
        {tabs.map(tab => <button key={tab} type="button" role="tab" id={`${tabId}-${tab}-tab`} aria-controls={`${tabId}-${tab}-panel`}
          aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1}
          className={`security-detail-tab${activeTab === tab ? ' security-detail-tab-active' : ''}`}
          onClick={() => setActiveTab(tab)} onKeyDown={event => handleTabKeyDown(event, tab)}>{tabLabels[tab]}</button>)}
      </div>

      <div role="tabpanel" id={`${tabId}-overview-panel`} aria-labelledby={`${tabId}-overview-tab`} className="security-detail-panel" hidden={activeTab !== 'overview'}>
        <SourceCode finding={finding} file={file} />
        <div className="security-detail-cards">
          <section className="security-detail-card" aria-labelledby={`${tabId}-explanation-title`}>
            <h2 id={`${tabId}-explanation-title`}>Explanation</h2>
            <p>{finding.explanation ?? finding.description ?? 'No explanation is available for this finding.'}</p>
          </section>
          <section className="security-detail-card" aria-labelledby={`${tabId}-remediation-title`}>
            <h2 id={`${tabId}-remediation-title`}>Remediation</h2>
            <p>{finding.remediation?.summary ?? 'No remediation guidance is available for this finding.'}</p>
            {finding.remediation && <button type="button" className="security-detail-remediation-link" onClick={() => setActiveTab('remediation')}>View remediation →</button>}
          </section>
        </div>
      </div>
      <section role="tabpanel" id={`${tabId}-remediation-panel`} aria-labelledby={`${tabId}-remediation-tab`} className="security-detail-card security-detail-panel-card" hidden={activeTab !== 'remediation'}>
        <h2>Remediation</h2>
        <p>{finding.remediation?.guidance ?? finding.remediation?.summary ?? 'No remediation guidance is available for this finding.'}</p>
      </section>
      <section role="tabpanel" id={`${tabId}-evidence-panel`} aria-labelledby={`${tabId}-evidence-tab`} className="security-detail-card security-detail-panel-card" hidden={activeTab !== 'evidence'}>
        <h2>Evidence</h2>
        <p>{finding.evidence?.summary ?? 'No additional evidence is available for this finding.'}</p>
        {finding.evidence?.observations?.length ? <ul>{finding.evidence.observations.map(observation => <li key={observation}>{observation}</li>)}</ul> : null}
        {finding.sourceContext && <details className="security-detail-expand"><summary>Source context</summary><SourceCode finding={finding} file={file} /></details>}
      </section>
    </section>
  )
}
