import type { PipelineRunFilters, RunStatus } from '../types/pipelineRun'
import { RUN_STATUS_LABELS } from '../utils/pipelineRun'
import { DateRangeFilter } from './DateRangeFilter'

interface PipelineRunFilterBarProps {
  filters: PipelineRunFilters
  branches: string[]
  disabled?: boolean
  onChange: (filters: PipelineRunFilters) => void
}

const statusOptions = Object.entries(RUN_STATUS_LABELS) as [RunStatus, string][]

export function PipelineRunFilterBar({ filters, branches, disabled, onChange }: PipelineRunFilterBarProps) {
  return (
    <fieldset className="pr-filters" disabled={disabled}>
      <legend className="pr-visually-hidden">Filter pipeline runs</legend>
      <input
        type="search"
        className="pr-control pr-filters__search"
        placeholder="Search runs, commits, or author…"
        aria-label="Search runs, commits, or author"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />
      <select
        className="pr-control pr-control--select"
        aria-label="Filter by status"
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value as PipelineRunFilters['status'] })}
      >
        <option value="all">All status</option>
        {statusOptions.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select
        className="pr-control pr-control--select"
        aria-label="Filter by branch"
        value={filters.branch}
        onChange={(event) => onChange({ ...filters, branch: event.target.value })}
      >
        <option value="all">All branches</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>{branch}</option>
        ))}
      </select>
      <DateRangeFilter from={filters.from} to={filters.to} onChange={(range) => onChange({ ...filters, ...range })} />
    </fieldset>
  )
}
