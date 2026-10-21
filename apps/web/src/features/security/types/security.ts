export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type FindingStatus = 'open' | 'acknowledged' | 'resolved'
export type ScanStatus = 'running' | 'completed' | 'failed'
export type PolicyDecision = 'passed' | 'blocked' | 'requires_review'

export interface SecurityFinding {
  id: string
  title: string
  contract: string
  severity: Severity
  status: FindingStatus
  detectedAt: string
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

/** Feature-local contract; replace the adapter when the NestJS API is agreed. */
export interface SecurityService {
  readonly source: 'mock' | 'api'
  listScans(projectId: string, signal?: AbortSignal): Promise<SecurityScan[]>
  runAnalysis(projectId: string, signal?: AbortSignal): Promise<SecurityScan>
}
