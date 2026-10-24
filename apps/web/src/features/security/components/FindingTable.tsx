import { findingStatusLabels, formatScanDate, severityLabels } from '../securityUtils'
import type { SecurityFinding } from '../types/security'

interface Props {
  findings: SecurityFinding[]
  pipelineRunId: string
  onOpenDetails: (findingId: string) => void
}

export function FindingTable({ findings, pipelineRunId, onOpenDetails }: Props) {
  return (
    <div className="security-table-scroll" role="region" aria-label="Security findings" tabIndex={0}>
      <table className="security-table">
        <caption className="security-sr-only">Findings for pipeline run {pipelineRunId}</caption>
        <colgroup>{[95, 290, 130, 110, 150, 100, 203].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
        <thead><tr>{['ID', 'Title', 'Contract', 'Severity', 'Status', 'Linked run', 'Detected'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{findings.map(finding => (
          <tr key={finding.id}>
            <td>{finding.id}</td>
            <td><button className="security-finding-link" onClick={() => onOpenDetails(finding.id)} aria-label={`View ${finding.id}: ${finding.title}`}>{finding.title}</button></td>
            <td>{finding.contract}</td>
            <td className={`security-tone-${finding.severity}`}>{severityLabels[finding.severity]}</td>
            <td className={`security-tone-${finding.status}`}>{findingStatusLabels[finding.status]}</td>
            <td>#{pipelineRunId}</td>
            <td><time dateTime={finding.detectedAt}>{formatScanDate(finding.detectedAt)}</time></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
