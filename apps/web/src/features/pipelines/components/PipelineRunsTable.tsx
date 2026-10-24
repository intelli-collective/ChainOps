import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PipelineRun } from '../types/pipelineRun'
import { formatDuration, formatStartedAt, pipelineRunPath, shortSha } from '../utils/pipelineRun'
import { RunStatusBadge } from './RunStatusBadge'

interface PipelineRunsTableProps {
  projectId: string
  runs: PipelineRun[]
}

export function PipelineRunsTable({ projectId, runs }: PipelineRunsTableProps) {
  const navigate = useNavigate()
  return (
    <div className="pr-table-wrap" tabIndex={0} role="region" aria-label="Pipeline runs">
      <table className="pr-table">
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Commit</th>
            <th scope="col">Branch</th>
            <th scope="col">Duration</th>
            <th scope="col">Status</th>
            <th scope="col">Author</th>
            <th scope="col">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            // The whole row opens the run; the run number is the keyboard-accessible link.
            <tr key={run.id} className="pr-table__row" onClick={() => navigate(pipelineRunPath(projectId, run.id))}>
              <td>
                <Link className="pr-link" to={pipelineRunPath(projectId, run.id)} aria-label={`Open run #${run.runNumber}`} onClick={(event: MouseEvent) => event.stopPropagation()}>
                  #{run.runNumber}
                </Link>
              </td>
              <td><code className="pr-sha" title={run.commitSha}>{shortSha(run.commitSha)}</code></td>
              <td>{run.branch}</td>
              <td>{formatDuration(run.durationSeconds)}</td>
              <td><RunStatusBadge status={run.status} /></td>
              <td>{run.author}</td>
              <td><time dateTime={run.startedAt}>{formatStartedAt(run.startedAt)}</time></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PipelineRunsTableSkeleton() {
  return (
    <div className="pr-table-wrap" aria-busy="true" aria-label="Loading pipeline runs">
      <table className="pr-table">
        <tbody>
          {Array.from({ length: 6 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: 7 }, (_, cell) => (
                <td key={cell}><span className="pr-skeleton" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
