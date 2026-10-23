import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, ProjectGate, StateMessage } from '../components/PageChrome'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { ProjectSummary } from '../types/pipelineRun'
import { pipelineRunPath, pipelineRunsPath, setupRepositoryPath, shortSha } from '../utils/pipelineRun'
import '../pipelines.css'

const CHECK_LABELS: [string, string[]][] = [
  ['Checkout', ['checkout']], ['Build', ['build', 'compile']], ['Test', ['test']], ['Slither', ['slither', 'security']], ['Policy', ['policy']],
]

/** Frame 24 · Run pipeline (manual run for a chosen branch). */
export function RunPipelinePage({ projectId, api = pipelineApi }: { projectId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="the pipeline">{(project) => <RunForm project={project} routeId={projectId} api={api} />}</ProjectGate>
}

function RunForm({ project, routeId, api }: { project: ProjectSummary; routeId: string; api: PipelineApi }) {
  const navigate = useNavigate()
  const { state, reload } = useLoad(async () => {
    const config = await api.getConfig(project.id)
    return { config, branches: config ? await api.pipelineBranches(project.id) : null }
  }, [project.id])
  const [branch, setBranch] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const data = state.status === 'ready' ? state.data : null
  const selected = branch ?? data?.branches?.defaultBranch ?? ''
  const selectedSha = data?.branches?.branches.find((item) => item.name === selected)?.commitSha
  const checks = data?.config ? CHECK_LABELS.filter(([, keys]) => keys.some((key) => (data.config!.stages as string[]).includes(key))).map(([label]) => label) : []

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!data?.branches?.branches.some((item) => item.name === selected)) { setError('Choose a branch from the list.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const run = await api.startRun(project.id, selected)
      navigate(pipelineRunPath(routeId, run.id))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start the run.')
      setSubmitting(false)
    }
  }

  return (
    <section className="pr-page" aria-labelledby="run-pipeline-title">
      <PageHeader back={pipelineRunsPath(routeId)} crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: 'Run pipeline' }]}
        title="Run pipeline" subtitle="Choose a branch and start a pipeline run." />
      {state.status === 'loading' && <div className="pr-card pr-card--narrow" aria-busy="true"><span className="pr-skeleton pr-skeleton--title" /><span className="pr-skeleton" /><span className="pr-skeleton" /></div>}
      {state.status === 'error' && <StateMessage role="alert" title="Couldn’t load branches" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />}
      {data && !data.config && (
        <StateMessage title="No pipeline configured" body="Connect a repository and configure the pipeline before starting a run."
          action={<Link className="pr-primary-button" to={setupRepositoryPath(routeId)}>Connect repository →</Link>} />
      )}
      {data?.config && data.branches && (
        <form className="pr-card pr-card--narrow" onSubmit={submit} noValidate>
          <h2 id="run-pipeline-title" className="pr-card__title">{project.name} · Manual run</h2>
          <label className="pr-label" htmlFor="run-branch">Branch</label>
          <select id="run-branch" className="pr-control pr-control--select pr-control--block" value={selected} disabled={submitting}
            onChange={(event) => { setBranch(event.target.value); setError(null) }} aria-describedby="run-branch-help">
            {data.branches.branches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          <p id="run-branch-help" className="pr-help">
            {data.branches.repository}{selectedSha && <> · head <code className="pr-sha" title={selectedSha}>{shortSha(selectedSha)}</code></>}
          </p>
          <p className="pr-checks">Checks: {checks.map((label, index) => <span key={label}>{index > 0 && <span aria-hidden="true"> → </span>}{label}</span>)}</p>
          <p className="pr-help">The configured checks will run against the selected revision. The run is pinned to the exact commit the branch points at when you start it.</p>
          {error && <p className="pr-form-error" role="alert">{error}</p>}
          <div className="pr-form-actions pr-form-actions--start">
            <Link className="pr-outline-button" to={pipelineRunsPath(routeId)}>Cancel</Link>
            <button type="submit" className="pr-primary-button pr-primary-button--wide" disabled={submitting}>{submitting ? 'Starting…' : <>Start run <span aria-hidden="true">→</span></>}</button>
          </div>
        </form>
      )}
    </section>
  )
}
