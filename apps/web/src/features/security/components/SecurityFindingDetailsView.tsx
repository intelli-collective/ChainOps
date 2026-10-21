import { findingStatusLabels, severityLabels } from '../securityUtils'
import type { SecurityFinding, SecurityScan } from '../types/security'
import '../pages/security.css'

export interface SecurityFindingDetailsViewProps {
  scan: SecurityScan
  finding: SecurityFinding
  onBack: () => void
}

function formatDetectedAt(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Colombo',
  }).format(new Date(timestamp))
}

/** The Figma 27:517 found-finding view. Data loading and controls follow in later stages. */
export function SecurityFindingDetailsView({ scan, finding, onBack }: SecurityFindingDetailsViewProps) {
  const file = finding.sourceLocation?.file ?? finding.contract
  return (
    <section className="security-dashboard security-detail" aria-labelledby="security-finding-title">
      <nav className="security-detail-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={onBack}>Security</button>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{finding.title}</span>
      </nav>

      <div className="security-heading">
        <h1 id="security-finding-title">{finding.title}</h1>
        <button type="button" className="security-detail-acknowledge" disabled title="Acknowledgement is available in the next stage">Acknowledge</button>
      </div>
      <p className="security-description">
        {finding.id}{finding.detector ? ` detected by ${finding.detector}` : ''}
        {finding.description ? ` · ${finding.description}` : ''}
      </p>

      <div className="security-detail-meta" aria-label="Finding metadata">
        <p className={`security-detail-meta-primary security-tone-${finding.severity}`}>
          <span>{severityLabels[finding.severity]} severity</span>
          <span aria-hidden="true">·</span>
          <span>{findingStatusLabels[finding.status]}</span>
          <span aria-hidden="true">·</span>
          <span>{file}</span>
          {finding.sourceLocation && <><span aria-hidden="true">·</span><span>Line {finding.sourceLocation.line}</span></>}
        </p>
        <p className="security-detail-meta-secondary">
          <span>Linked run #{scan.pipelineRunId}</span>
          <span aria-hidden="true">·</span>
          <span>Commit {scan.commitSha}</span>
          <span aria-hidden="true">·</span>
          <span>Detected <time dateTime={finding.detectedAt}>{formatDetectedAt(finding.detectedAt)}</time></span>
        </p>
      </div>

      <div className="security-detail-tabs" aria-label="Finding detail sections">
        <span className="security-detail-tab security-detail-tab-active">Overview</span>
        <span className="security-detail-tab">Remediation</span>
        <span className="security-detail-tab">Evidence</span>
      </div>

      <section className="security-detail-source" aria-label={`Source code in ${file}`}>
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

      <div className="security-detail-cards">
        <section className="security-detail-card" aria-labelledby="security-explanation-title">
          <h2 id="security-explanation-title">Explanation</h2>
          <p>{finding.explanation ?? finding.description ?? 'No explanation is available for this finding.'}</p>
        </section>
        <section className="security-detail-card" aria-labelledby="security-remediation-title">
          <h2 id="security-remediation-title">Remediation</h2>
          <p>{finding.remediation?.summary ?? 'No remediation guidance is available for this finding.'}</p>
          {finding.remediation && <span className="security-detail-remediation-link">View remediation →</span>}
        </section>
      </div>
    </section>
  )
}
