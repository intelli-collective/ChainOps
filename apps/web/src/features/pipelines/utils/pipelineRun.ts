import type { PipelineRun, PipelineRunFilters, RunStatus } from '../types/pipelineRun'

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  success: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const DEFAULT_FILTERS: PipelineRunFilters = {
  search: '',
  status: 'all',
  branch: 'all',
  from: '2026-10-01',
  to: '2026-10-31',
}

export const pipelineRunsPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/pipelines`

export const pipelineRunPath = (projectId: string, runId: string) =>
  `${pipelineRunsPath(projectId)}/${encodeURIComponent(runId)}`

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
