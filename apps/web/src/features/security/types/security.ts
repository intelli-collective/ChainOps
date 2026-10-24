export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type FindingStatus = 'open' | 'acknowledged' | 'resolved'
export type ScanStatus = 'running' | 'completed' | 'failed'
export type PolicyDecision = 'passed' | 'blocked' | 'requires_review'

export interface SourceLocation {
  file: string
  line: number
  endLine?: number
}

export interface SourceContext {
  lines: { number: number; text: string }[]
  highlightedLine: number
}

export interface FindingRemediation {
  summary: string
  guidance?: string
}

export interface FindingEvidence {
  summary: string
  observations?: string[]
}

export interface SecurityFinding {
  id: string
  title: string
  contract: string
  severity: Severity
  status: FindingStatus
  detectedAt: string
  detector?: string
  description?: string
  sourceLocation?: SourceLocation
  sourceContext?: SourceContext
  explanation?: string
  remediation?: FindingRemediation
  evidence?: FindingEvidence
}

export interface SecurityScan {
  id: string
  number: number
  projectId: string
  pipelineRunId: string
  commitSha: string
  startedAt: string
  status: ScanStatus
  findings: SecurityFinding[]
  policy: { decision: PolicyDecision; reason: string } | null
  error?: string
}

export type SecurityFindingLookup =
  | { status: 'found'; scan: SecurityScan; finding: SecurityFinding }
  | { status: 'scan-not-found' }
  | { status: 'finding-not-found'; scan: SecurityScan }

/** Feature-local contract; replace the adapter when the NestJS API is agreed. */
export interface SecurityService {
  readonly source: 'mock' | 'api'
  listScans(projectId: string, signal?: AbortSignal): Promise<SecurityScan[]>
  getFindingDetail(projectId: string, scanId: string, findingId?: string, signal?: AbortSignal): Promise<SecurityFindingLookup>
  runAnalysis(projectId: string, signal?: AbortSignal): Promise<SecurityScan>
}
