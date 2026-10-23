import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, ProjectGate, SetupSteps, StateMessage } from '../components/PageChrome'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { ConfigStage, GitHubBranch, GitHubRepository, PipelineConfig, PipelineTrigger, ProjectSummary } from '../types/pipelineRun'
import { pipelineRunsPath, setupPipelinePath, setupRepositoryPath } from '../utils/pipelineRun'
import { platformApi } from '../../../app/api/platform'
import '../pipelines.css'

const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/
const joinList = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** Frame 21 · Connect repository (project setup step 2). */
export function ConnectRepositoryPage({ projectId, api = pipelineApi }: { projectId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="project setup">{(project) => <ConnectRepository project={project} routeId={projectId} api={api} />}</ProjectGate>
}

function ConnectRepository({ project, routeId, api }: { project: ProjectSummary; routeId: string; api: PipelineApi }) {
  const { state, reload } = useLoad(async () => ({
    status: await api.githubStatus(project.id), config: await api.getConfig(project.id),
    setupComplete: (await platformApi.project(project.id).catch(() => null))?.setupComplete ?? true,
  }), [project.id])
  // While the project is being created, Back returns to wizard step 1 (project details).
  const backTo = state.status === 'ready' && !state.data.setupComplete ? `/projects/${encodeURIComponent(routeId)}/setup/details` : '/projects'
  return (
    <section className="pr-page" aria-labelledby="setup-title">
      <PageHeader back={backTo} crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: 'Connect your repository' }]}
        title="Connect your repository" subtitle="Link your repository to enable automated builds, security checks and deployments." />
      <div className="pr-setup">
        <SetupSteps current={1} completed={[0]} />
        {state.status === 'loading' && <div className="pr-card" aria-busy="true"><span className="pr-skeleton pr-skeleton--title" /><span className="pr-skeleton" /><span className="pr-skeleton" /></div>}
        {state.status === 'error' && <StateMessage role="alert" title="Couldn’t load the GitHub connection" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />}
        {state.status === 'ready' && <ConnectForm config={state.data.config} project={project} routeId={routeId} api={api} backTo={backTo} />}
      </div>
    </section>
  )
}

function ConnectForm({ config, project, routeId, api, backTo }: { config: PipelineConfig | null; project: ProjectSummary; routeId: string; api: PipelineApi; backTo: string }) {
  const navigate = useNavigate()
  // Pre-filled from an existing configuration.
  const [owner, setOwner] = useState(config?.repository.split('/')[0] ?? '')
  const [repos, setRepos] = useState<GitHubRepository[] | null>(null)
  const [repository, setRepository] = useState(config?.repository ?? '')
  const [branchList, setBranchList] = useState<{ repository: string; items: GitHubBranch[] } | null>(null)
  const [branch, setBranch] = useState(config?.branch ?? '')
  const [loading, setLoading] = useState<'repos' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Branch options belong to the repository they were loaded for.
  const branches = branchList?.repository === repository ? branchList.items : null
  const loadingBranches = repository !== '' && branches === null
  useEffect(() => {
    if (!repository) return
    let active = true
    api.githubBranches(project.id, repository).then(
      (items) => {
        if (!active) return
        setBranchList({ repository, items })
        setBranch((current) => (items.some((item) => item.name === current) ? current : (repos?.find((repo) => repo.fullName === repository)?.defaultBranch ?? items[0]?.name ?? '')))
      },
      (failure: unknown) => { if (active) { setBranchList({ repository, items: [] }); setError(failure instanceof Error ? failure.message : 'Could not load branches.') } },
    )
    return () => { active = false }
  }, [api, project.id, repository, repos])

  const findRepositories = async () => {
    const value = owner.trim()
    if (!OWNER.test(value)) { setError('Enter a GitHub user or organization name, for example "NomicFoundation".'); return }
    setLoading('repos'); setError(null)
    try {
      const items = await api.githubRepositories(project.id, value)
      setRepos(items)
      if (!items.some((item) => item.fullName === repository)) { setRepository(''); setBranch('') }
      if (items.length === 0) setError(`${value} has no public repositories.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load repositories.')
    } finally {
      setLoading(null)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    if (!repository) { setError('Select a repository.'); return }
    if (!branch || !branches?.some((item) => item.name === branch)) { setError('Select the default branch.'); return }
    setLoading('save'); setError(null)
    try {
      if (config) await api.updateConfig(project.id, { repository, branch })
      else await api.createConfig(project.id, { name: `${project.name} CI`, repository, branch, stages: ['checkout', 'build', 'test', 'slither', 'policy'] })
      navigate(setupPipelinePath(routeId))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the repository.')
      setLoading(null)
    }
  }

  const repositoryOptions = repos ?? (config ? [{ fullName: config.repository, name: config.repository.split('/')[1], defaultBranch: config.branch, description: null, updatedAt: '' }] : [])

  return (
    <form className="pr-card pr-setup__card" onSubmit={submit} noValidate>
      <h2 className="pr-card__subtitle">GitHub account</h2>
      <p className="pr-connection"><span className="pr-dot" aria-hidden="true" /> Public GitHub access</p>
      <p className="pr-help">{config ? `Repository connection active: ${config.repository}.` : 'No organization GitHub integration is connected yet, so public repositories are available.'}</p>

      <label className="pr-label" htmlFor="gh-owner">Organization / Account</label>
      <div className="pr-inline-field">
        <input id="gh-owner" className="pr-control pr-control--block" value={owner} placeholder="e.g. NomicFoundation" autoComplete="off" disabled={loading !== null}
          onChange={(event) => { setOwner(event.target.value); setError(null) }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void findRepositories() } }} />
        <button type="button" className="pr-outline-button" onClick={findRepositories} disabled={loading !== null || !owner.trim()}>{loading === 'repos' ? 'Loading…' : 'Find repositories'}</button>
      </div>

      <label className="pr-label" htmlFor="gh-repo">Repository</label>
      <select id="gh-repo" className="pr-control pr-control--select pr-control--block" value={repository} disabled={loading !== null || repositoryOptions.length === 0}
        onChange={(event) => { setRepository(event.target.value); setBranch(''); setError(null) }}>
        <option value="" disabled>{repositoryOptions.length ? 'Select a repository' : 'Find repositories first'}</option>
        {repositoryOptions.map((repo) => <option key={repo.fullName} value={repo.fullName}>{repo.name}</option>)}
      </select>

      <label className="pr-label" htmlFor="gh-branch">Default branch</label>
      <select id="gh-branch" className="pr-control pr-control--select pr-control--block" value={branch} disabled={loading !== null || !branches?.length}
        onChange={(event) => { setBranch(event.target.value); setError(null) }}>
        <option value="" disabled>{loadingBranches ? 'Loading branches…' : 'Select a branch'}</option>
        {branches?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select>

      <p className="pr-help pr-help--muted"><span aria-hidden="true">○</span> Webhooks not configured · Start runs manually from Pipeline Runs.</p>
      {error && <p className="pr-form-error" role="alert">{error}</p>}
      <div className="pr-form-actions">
        <Link className="pr-outline-button pr-outline-button--wide" to={backTo}><span aria-hidden="true">←</span> Back</Link>
        <button type="submit" className="pr-primary-button pr-primary-button--wide" disabled={loading !== null || loadingBranches}>{loading === 'save' ? 'Saving…' : <>Connect repository <span aria-hidden="true">→</span></>}</button>
      </div>
    </form>
  )
}

const TRIGGER_OPTIONS: { value: string; label: string; triggers: PipelineTrigger[] }[] = [
  { value: 'push_pr', label: 'Push to main and pull requests', triggers: ['push', 'pull_request'] },
  { value: 'push', label: 'Push to main only', triggers: ['push'] },
  { value: 'pr', label: 'Pull requests only', triggers: ['pull_request'] },
  { value: 'manual', label: 'Manual runs only', triggers: [] },
]
const triggerValue = (triggers: PipelineTrigger[]) =>
  TRIGGER_OPTIONS.find((option) => option.triggers.length === triggers.filter((item) => item !== 'tag').length && option.triggers.every((item) => triggers.includes(item)))?.value ?? 'push_pr'

/** Frame 22 · Configure pipeline (project setup step 3). */
export function ConfigurePipelinePage({ projectId, api = pipelineApi }: { projectId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="project setup">{(project) => <ConfigureSetup project={project} routeId={projectId} api={api} />}</ProjectGate>
}

function ConfigureSetup({ project, routeId, api }: { project: ProjectSummary; routeId: string; api: PipelineApi }) {
  const { state, reload } = useLoad(async () => ({
    config: await api.getConfig(project.id),
    setupComplete: (await platformApi.project(project.id).catch(() => null))?.setupComplete ?? true,
  }), [project.id])
  return (
    <section className="pr-page" aria-labelledby="setup-title">
      <PageHeader back={setupRepositoryPath(routeId)} crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: 'Configure pipeline' }]}
        title="Configure pipeline" subtitle="Choose the checks to run for your project." />
      <div className="pr-setup">
        <SetupSteps current={2} completed={[0, 1]} />
        {state.status === 'loading' && <div className="pr-card" aria-busy="true"><span className="pr-skeleton pr-skeleton--title" /><span className="pr-skeleton" /></div>}
        {state.status === 'error' && <StateMessage role="alert" title="Couldn’t load the pipeline" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />}
        {state.status === 'ready' && !state.data.config && (
          <StateMessage title="Connect a repository first" body="The pipeline needs a repository before checks can be configured."
            action={<Link className="pr-primary-button" to={setupRepositoryPath(routeId)}>Connect repository →</Link>} />
        )}
        {state.status === 'ready' && state.data.config && <ChecksForm config={state.data.config} project={project} routeId={routeId} api={api} setupComplete={state.data.setupComplete} />}
      </div>
    </section>
  )
}

function ChecksForm({ config, project, routeId, api, setupComplete }: { config: PipelineConfig; project: ProjectSummary; routeId: string; api: PipelineApi; setupComplete: boolean }) {
  const navigate = useNavigate()
  const enabled = new Set<string>(config.stages)
  const [build, setBuild] = useState(config.buildCommand ?? config.effectiveBuildCommand)
  const [test, setTest] = useState(config.testCommand ?? config.effectiveTestCommand)
  const [checks, setChecks] = useState({ build: enabled.has('build') || enabled.has('compile'), test: enabled.has('test'), slither: enabled.has('slither') || enabled.has('security') })
  const [trigger, setTrigger] = useState(triggerValue(config.triggers))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = [checks.build && 'Build', checks.test && 'tests', checks.slither && 'Slither checks'].filter(Boolean) as string[]
  const summary = selected.length ? `${joinList(selected)} run` : 'Only checkout runs'
  const when = trigger === 'manual' ? 'when a run is started manually.' : 'on repository updates once webhooks are connected; until then, start runs manually.'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (checks.build && !build.trim()) { setError('Enter a build command or turn off “Build contracts”.'); return }
    if (checks.test && !test.trim()) { setError('Enter a test command or turn off “Run tests”.'); return }
    setSaving(true); setError(null)
    const stages: ConfigStage[] = ['checkout', ...(checks.build ? ['build' as const] : []), ...(checks.test ? ['test' as const] : []), ...(checks.slither ? ['slither' as const] : []), 'policy']
    try {
      await api.updateConfig(project.id, {
        stages,
        // Keep the framework default when the command was not changed.
        buildCommand: build.trim() === config.effectiveBuildCommand && config.buildCommand === null ? null : build.trim(),
        testCommand: test.trim() === config.effectiveTestCommand && config.testCommand === null ? null : test.trim(),
        triggers: [...(TRIGGER_OPTIONS.find((option) => option.value === trigger)?.triggers ?? []), ...(config.triggers.includes('tag') ? ['tag' as const] : [])],
      })
      // During project creation the next step is the team step (M5); otherwise back to the runs.
      navigate(setupComplete ? pipelineRunsPath(routeId) : `/projects/${encodeURIComponent(routeId)}/setup/team`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the pipeline.')
      setSaving(false)
    }
  }

  return (
    <form className="pr-card pr-setup__card" onSubmit={submit} noValidate>
      <h2 className="pr-card__subtitle">Build &amp; test</h2>
      <label className="pr-label" htmlFor="build-command">Build command</label>
      <input id="build-command" className="pr-control pr-control--block" value={build} disabled={saving || !checks.build} onChange={(event) => setBuild(event.target.value)} spellCheck={false} />
      <label className="pr-label" htmlFor="test-command">Test command</label>
      <input id="test-command" className="pr-control pr-control--block" value={test} disabled={saving || !checks.test} onChange={(event) => setTest(event.target.value)} spellCheck={false} />
      <fieldset className="pr-checkboxes" disabled={saving}>
        <legend className="pr-visually-hidden">Checks</legend>
        <label><input type="checkbox" checked={checks.build} onChange={(event) => setChecks({ ...checks, build: event.target.checked })} /> Build contracts</label>
        <label><input type="checkbox" checked={checks.test} onChange={(event) => setChecks({ ...checks, test: event.target.checked })} /> Run tests</label>
        <label><input type="checkbox" checked={checks.slither} onChange={(event) => setChecks({ ...checks, slither: event.target.checked })} /> Slither analysis</label>
      </fieldset>
      <label className="pr-label" htmlFor="pipeline-trigger">Pipeline trigger</label>
      <select id="pipeline-trigger" className="pr-control pr-control--select pr-control--block" value={trigger} disabled={saving} onChange={(event) => setTrigger(event.target.value)}>
        {TRIGGER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <p className="pr-help">{summary} {when}{checks.slither && ' Slither analysis is evaluated by the Security module.'}</p>
      {error && <p className="pr-form-error" role="alert">{error}</p>}
      <div className="pr-form-actions">
        <Link className="pr-outline-button pr-outline-button--wide" to={setupRepositoryPath(routeId)}><span aria-hidden="true">←</span> Back</Link>
        <button type="submit" className="pr-primary-button pr-primary-button--wide" disabled={saving}>{saving ? 'Saving…' : setupComplete ? <>Save &amp; continue <span aria-hidden="true">→</span></> : <>Invite team <span aria-hidden="true">→</span></>}</button>
      </div>
    </form>
  )
}
