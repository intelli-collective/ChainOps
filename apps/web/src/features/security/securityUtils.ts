import type { FindingStatus, SecurityFinding, Severity } from './types/security'

export const severityLabels: Record<Severity, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', informational: 'Informational',
}
export const findingStatusLabels: Record<FindingStatus, string> = {
  open: 'Open', acknowledged: 'Acknowledged', resolved: 'Resolved',
}
export const policyLabels = { passed: 'Passed', blocked: 'Blocked', requires_review: 'Requires review' }

export interface FindingFilters {
  search: string
  severity: string
  status: string
  contract: string
}
export const emptyFilters: FindingFilters = { search: '', severity: '', status: '', contract: '' }

export function filterFindings(findings: SecurityFinding[], filters: FindingFilters) {
  const search = filters.search.trim().toLowerCase()
  return findings.filter(finding =>
    (!filters.severity || finding.severity === filters.severity) &&
    (!filters.status || finding.status === filters.status) &&
    (!filters.contract || finding.contract === filters.contract) &&
    (!search || `${finding.id} ${finding.title} ${finding.contract}`.toLowerCase().includes(search)),
  )
}

export function countSeverities(findings: SecurityFinding[]): Record<Severity, number> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 }
  for (const finding of findings) counts[finding.severity]++
  return counts
}

export function scanDetailsPath(projectId: string, scanId: string) {
  return `/projects/${encodeURIComponent(projectId)}/security/scans/${encodeURIComponent(scanId)}`
}

export function formatScanDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date))
}
