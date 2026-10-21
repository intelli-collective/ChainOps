import { useEffect, useMemo, useState } from 'react'
import { PipelineRunFilterBar } from '../components/PipelineRunFilterBar'
import { PipelineRunsTable, PipelineRunsTableSkeleton } from '../components/PipelineRunsTable'
import { mockPipelineRunService } from '../services/pipelineRunService'
import type { PipelineRun, PipelineRunFilters, PipelineRunService } from '../types/pipelineRun'
import { CLEARED_FILTERS, DEFAULT_FILTERS, filterRuns, pipelineRunsPath } from '../utils/pipelineRun'
import '../pipelines.css'

interface PipelineRunsPageProps {
  projectId: string
  service?: PipelineRunService
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: PipelineRun[] }

export function PipelineRunsPage({ projectId, service = mockPipelineRunService }: PipelineRunsPageProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<PipelineRunFilters>(DEFAULT_FILTERS)
  const [isStarting, setIsStarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    service.listRuns(projectId).then(
      (runs) => !cancelled && setState({ status: 'ready', runs }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
    )
    return () => {
      cancelled = true
    }
  }, [projectId, reloadKey, service])

  const runs = useMemo(() => (state.status === 'ready' ? state.runs : []), [state])
  const branches = useMemo(() => [...new Set(runs.map((run) => run.branch))].sort(), [runs])
  const visibleRuns = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const retry = () => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }

  const startMockRun = async () => {
    if (state.status !== 'ready') return
    setIsStarting(true)
    try {
      const run = await service.simulateRun(projectId, state.runs)
      setState({ status: 'ready', runs: [run, ...state.runs] })
      setFilters(CLEARED_FILTERS)
      setNotice(`Mock run #${run.runNumber} added as Queued. Development data only — no pipeline was executed.`)
    } catch {
      setNotice('Could not simulate a pipeline run.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <section className="pr-page" aria-labelledby="pipeline-runs-title">
      <nav aria-label="Breadcrumb" className="pr-breadcrumb">
        <ol>
          <li><a href={pipelineRunsPath(projectId)}>Pipelines</a></li>
          <li aria-current="page">Pipeline Runs</li>
        </ol>
      </nav>

      <header className="pr-header">
        <div>
          <h1 id="pipeline-runs-title" className="pr-title">Pipeline Runs</h1>
          <p className="pr-subtitle">Build, test, and analyze smart contracts with security checks.</p>
        </div>
        <button
          type="button"
          className="pr-primary-button"
          onClick={startMockRun}
          disabled={state.status !== 'ready' || isStarting}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2v12L14 8z" fill="currentColor" /></svg>
          {isStarting ? 'Starting…' : 'Run pipeline'}
        </button>
      </header>

      {notice && (
        <div className="pr-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="pr-text-button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            Dismiss
          </button>
        </div>
      )}

      <PipelineRunFilterBar filters={filters} branches={branches} disabled={state.status !== 'ready'} onChange={setFilters} />

      {state.status === 'loading' && <PipelineRunsTableSkeleton />}

      {state.status === 'error' && (
        <div className="pr-state" role="alert">
          <p className="pr-state__title">Couldn’t load pipeline runs</p>
          <p className="pr-state__body">{state.message}. Check your connection and try again.</p>
          <button type="button" className="pr-secondary-button" onClick={retry}>Retry</button>
        </div>
      )}

      {state.status === 'ready' && runs.length === 0 && (
        <div className="pr-state">
          <p className="pr-state__title">No pipeline runs yet</p>
          <p className="pr-state__body">Runs will appear here once a pipeline is triggered for this project.</p>
        </div>
      )}

      {state.status === 'ready' && runs.length > 0 && visibleRuns.length === 0 && (
        <div className="pr-state">
          <p className="pr-state__title">No runs match your filters</p>
          <p className="pr-state__body">Try a different search term, status, branch, or date range.</p>
          <button type="button" className="pr-secondary-button" onClick={() => setFilters(CLEARED_FILTERS)}>
            Clear filters
          </button>
        </div>
      )}

      {state.status === 'ready' && visibleRuns.length > 0 && (
        <>
          <p className="pr-visually-hidden" role="status">{visibleRuns.length} of {runs.length} runs shown</p>
          <PipelineRunsTable projectId={projectId} runs={visibleRuns} />
        </>
      )}

      <a className="pr-link pr-config-link" href={`${pipelineRunsPath(projectId)}/configuration`}>
        Manage pipeline configuration <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}
