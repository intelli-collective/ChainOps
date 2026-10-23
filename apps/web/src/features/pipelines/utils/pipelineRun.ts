import type { PipelineRun, PipelineRunFilters, PipelineStage, RunStatus, RunTrigger, StageKey, StageStatus } from '../types/pipelineRun'

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  success: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  error: 'Error',
}

export const RUN_TRIGGER_LABELS: Record<RunTrigger, string> = {
  push: 'Triggered by push',
  pull_request: 'Triggered by pull request',
  manual: 'Triggered manually',
}

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  pending: 'Pending',
  running: 'In progress',
  success: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
}

export const stageTabId = (key: StageKey) => `pipeline-stage-tab-${key}`

/** Panel heading for a stage, e.g. "Build in progress" or "Test failed". */
export function stageHeading(stage: PipelineStage): string {
  if (stage.status === 'pending') return `${stage.name} not started`
  return `${stage.name} ${STAGE_STATUS_LABELS[stage.status].toLowerCase()}`
}

/** The stage to show first: the active one, else where the run stopped, else the last stage. */
export function defaultStage(stages: PipelineStage[]): PipelineStage | undefined {
  return (
    stages.find((stage) => stage.status === 'running') ??
    stages.find((stage) => stage.status === 'failed' || stage.status === 'cancelled') ??
    stages.at(-1)
  )
}

export const DEFAULT_FILTERS: PipelineRunFilters = { search: '', status: 'all', branch: 'all', from: '', to: '' }

export const pipelineRunsPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/pipelines`

export const pipelineRunPath = (projectId: string, runId: string) =>
  `${pipelineRunsPath(projectId)}/${encodeURIComponent(runId)}`

export const newRunPath = (projectId: string) => `${pipelineRunsPath(projectId)}/new`
export const configurationPath = (projectId: string) => `${pipelineRunsPath(projectId)}/configuration`
export const artifactsPath = (projectId: string, runId: string) => `${pipelineRunPath(projectId, runId)}/artifacts`
export const setupRepositoryPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/setup/repository`
export const setupPipelinePath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/setup/pipeline`

export const TERMINAL_RUN_STATUSES: RunStatus[] = ['success', 'failed', 'cancelled', 'error']
export const isActiveRun = (status: RunStatus) => status === 'queued' || status === 'running'

export const shortSha = (sha: string) => sha.slice(0, 7)

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Formats as `Oct 28, 2026 14:32` in the viewer's local time. */
export function formatStartedAt(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toLocalDateKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function filterRuns(runs: PipelineRun[], filters: PipelineRunFilters): PipelineRun[] {
  const query = filters.search.trim().toLowerCase().replace(/^#/, '')
  return runs.filter((run) => {
    if (filters.status !== 'all' && run.status !== filters.status) return false
    if (filters.branch !== 'all' && run.branch !== filters.branch) return false
    const day = toLocalDateKey(run.startedAt)
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
    if (!query) return true
    return [String(run.runNumber), run.commitSha, run.branch, run.author].some((field) =>
      field.toLowerCase().includes(query),
    )
  })
}

export const CLEARED_FILTERS: PipelineRunFilters = { search: '', status: 'all', branch: 'all', from: '', to: '' }

export function formatDateRange(from: string, to: string): string {
  const format = (key: string, withYear: boolean) =>
    new Date(`${key}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  if (from && to) return `${format(from, from.slice(0, 4) !== to.slice(0, 4))} – ${format(to, true)}`
  if (from) return `From ${format(from, true)}`
  if (to) return `Until ${format(to, true)}`
  return 'All dates'
}
