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

export type StageKey = 'checkout' | 'build' | 'test' | 'slither' | 'policy'

export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped'

export interface PipelineStageError {
  message: string
  detail?: string
}

export interface PipelineStage {
  key: StageKey
  name: string
  status: StageStatus
  /** Null when the stage has not finished. */
  durationSeconds: number | null
  logs: string[]
  error?: PipelineStageError
}

export interface PipelineRunDetails extends PipelineRun {
  contract?: { name: string; version: string }
  network?: string
  stages: PipelineStage[]
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
  /** Resolves to null when the run does not exist in the project. */
  getRun(projectId: string, runId: string): Promise<PipelineRunDetails | null>
  simulateCancel(run: PipelineRunDetails): Promise<PipelineRunDetails>
}
