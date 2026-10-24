import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProjectGate, StateMessage } from '../components/PageChrome'
import { PipelineRunFilterBar } from '../components/PipelineRunFilterBar'
import { PipelineRunsTable, PipelineRunsTableSkeleton } from '../components/PipelineRunsTable'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { PipelineRunFilters, ProjectSummary } from '../types/pipelineRun'
import { CLEARED_FILTERS, configurationPath, DEFAULT_FILTERS, filterRuns, isActiveRun, newRunPath, pipelineRunsPath, setupRepositoryPath } from '../utils/pipelineRun'
import '../pipelines.css'

/** Frame 23 · Pipeline Runs. */
export function PipelineRunsPage({ projectId, api = pipelineApi }: { projectId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="pipeline runs">{(project) => <RunsView project={project} routeId={projectId} api={api} />}</ProjectGate>
}

function RunsView({ project, routeId, api }: { project: ProjectSummary; routeId: string; api: PipelineApi }) {
  const [filters, setFilters] = useState<PipelineRunFilters>(DEFAULT_FILTERS)
  const { state, reload } = useLoad(
    async () => ({ runs: await api.listRuns(project.id), config: await api.getConfig(project.id) }),
    [project.id],
    { poll: (data) => data.runs.some((run) => isActiveRun(run.status)), intervalMs: 4000 },
  )
  const runs = useMemo(() => (state.status === 'ready' ? state.data.runs : []), [state])
  const branches = useMemo(() => [...new Set(runs.map((run) => run.branch))].sort(), [runs])
  const visibleRuns = useMemo(() => filterRuns(runs, filters), [runs, filters])
  const configured = state.status === 'ready' && state.data.config !== null

  return (
    <section className="pr-page" aria-labelledby="pipeline-runs-title" aria-busy={state.status === 'loading'}>
      <nav aria-label="Breadcrumb" className="pr-breadcrumb pr-breadcrumb--plain">
        <ol>
          <li><Link to={pipelineRunsPath(routeId)}>Pipelines</Link></li>
          <li aria-current="page">Pipeline Runs</li>
        </ol>
      </nav>
      <header className="pr-header">
        <h1 id="pipeline-runs-title" className="pr-title">Pipeline Runs</h1>
        {configured
          ? <Link className="pr-primary-button pr-primary-button--wide" to={newRunPath(routeId)}><span aria-hidden="true">▶</span> Run pipeline</Link>
          : <button type="button" className="pr-primary-button pr-primary-button--wide" disabled title="Configure the pipeline first"><span aria-hidden="true">▶</span> Run pipeline</button>}
      </header>
      <p className="pr-subtitle">Build, test, and analyze smart contracts with security checks.</p>

      <PipelineRunFilterBar filters={filters} branches={branches} disabled={state.status !== 'ready' || runs.length === 0} onChange={setFilters} />

      {state.status === 'loading' && <PipelineRunsTableSkeleton />}
      {state.status === 'error' && (
        <StateMessage role="alert" title="Couldn’t load pipeline runs" body={state.message}
          action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />
      )}
      {state.status === 'ready' && !configured && (
        <StateMessage title="Connect a repository to start" body={`${project.name} has no pipeline yet. Connect a GitHub repository and configure the checks to run.`}
          action={<Link className="pr-primary-button" to={setupRepositoryPath(routeId)}>Connect repository →</Link>} />
      )}
      {state.status === 'ready' && configured && runs.length === 0 && (
        <StateMessage title="No pipeline runs yet" body="Start a run to build and test the configured repository."
          action={<Link className="pr-secondary-button" to={newRunPath(routeId)}>Run pipeline</Link>} />
      )}
      {state.status === 'ready' && runs.length > 0 && visibleRuns.length === 0 && (
        <StateMessage title="No runs match your filters" body="Try a different search term, status, branch, or date range."
          action={<button type="button" className="pr-secondary-button" onClick={() => setFilters(CLEARED_FILTERS)}>Clear filters</button>} />
      )}
      {state.status === 'ready' && visibleRuns.length > 0 && (
        <>
          <p className="pr-visually-hidden" role="status">{visibleRuns.length} of {runs.length} runs shown</p>
          <PipelineRunsTable projectId={routeId} runs={visibleRuns} />
        </>
      )}

      <Link className="pr-link pr-config-link" to={configured ? configurationPath(routeId) : setupRepositoryPath(routeId)}>
        Manage pipeline configuration <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}
