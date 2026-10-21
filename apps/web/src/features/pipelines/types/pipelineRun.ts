export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type RunTrigger = 'push' | 'pull_request' | 'manual'

export interface PipelineRun {
  id: string
  projectId: string
  runNumber: number
  commitSha: string
  branch: string
  trigger: RunTrigger
  status: RunStatus
  author: string
  /** ISO 8601 timestamp. */
  startedAt: string
  /** Null while the run is queued or still running. */
  durationSeconds: number | null
}

export interface PipelineRunFilters {
  search: string
  status: RunStatus | 'all'
  branch: string | 'all'
  /** Inclusive local dates in `YYYY-MM-DD` format; empty string means unbounded. */
  from: string
  to: string
}

export interface PipelineRunService {
  listRuns(projectId: string): Promise<PipelineRun[]>
  simulateRun(projectId: string, existingRuns: PipelineRun[]): Promise<PipelineRun>
}
