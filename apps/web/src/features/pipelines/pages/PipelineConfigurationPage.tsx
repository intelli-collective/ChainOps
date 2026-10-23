import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ProjectGate, StateMessage } from '../components/PageChrome'
import { RunProvenance } from '../components/RunProvenance'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { ConfigStage, GitHubBranch, PipelineConfig, PipelineConfigInput, PipelineFramework, PipelineTrigger, ProjectSummary } from '../types/pipelineRun'
import { pipelineRunsPath, setupRepositoryPath } from '../utils/pipelineRun'
import '../pipelines.css'

const SECTIONS = [
  { id: 'cfg-general', label: 'General' }, { id: 'cfg-repository', label: 'Repository' }, { id: 'cfg-build', label: 'Build & Test' },
  { id: 'cfg-security', label: 'Security' }, { id: 'cfg-environment', label: 'Environment' }, { id: 'cfg-advanced', label: 'Advanced' },
]
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/

interface Draft {
  name: string
  repository: string
  branch: string
  framework: PipelineFramework
  triggers: PipelineTrigger[]
  build: boolean
  test: boolean
  slither: boolean
  buildCommand: string
  testCommand: string
  slitherConfig: string
}

const toDraft = (config: PipelineConfig): Draft => {
  const stages = new Set<string>(config.stages)
  return {
    name: config.name, repository: config.repository, branch: config.branch, framework: config.framework, triggers: config.triggers,
    build: stages.has('build') || stages.has('compile'), test: stages.has('test'), slither: stages.has('slither') || stages.has('security'),
    buildCommand: config.buildCommand ?? config.effectiveBuildCommand, testCommand: config.testCommand ?? config.effectiveTestCommand,
    slitherConfig: config.slitherConfig ?? '',
  }
}

/** Only the fields that changed, in the API's shape. */
function changes(config: PipelineConfig, draft: Draft): PipelineConfigInput {
  const before = toDraft(config)
  const patch: PipelineConfigInput = {}
  if (draft.name.trim() !== before.name) patch.name = draft.name.trim()
  if (draft.repository.trim() !== before.repository) patch.repository = draft.repository.trim()
  if (draft.branch !== before.branch) patch.branch = draft.branch
  if (draft.framework !== before.framework) patch.framework = draft.framework
  if ([...draft.triggers].sort().join() !== [...before.triggers].sort().join()) patch.triggers = draft.triggers
  if (draft.build !== before.build || draft.test !== before.test || draft.slither !== before.slither) {
    patch.stages = ['checkout', ...(draft.build ? ['build'] : []), ...(draft.test ? ['test'] : []), ...(draft.slither ? ['slither'] : []), 'policy'] as ConfigStage[]
  }
  if (draft.buildCommand.trim() !== before.buildCommand) patch.buildCommand = draft.buildCommand.trim() || null
  if (draft.testCommand.trim() !== before.testCommand) patch.testCommand = draft.testCommand.trim() || null
  if (draft.slitherConfig.trim() !== before.slitherConfig) patch.slitherConfig = draft.slitherConfig.trim() || null
  return patch
}

/** Frame 32 · Pipeline Configuration. */
export function PipelineConfigurationPage({ projectId, api = pipelineApi }: { projectId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="pipeline configuration">{(project) => <ConfigurationView project={project} routeId={projectId} api={api} />}</ProjectGate>
}

function ConfigurationView({ project, routeId, api }: { project: ProjectSummary; routeId: string; api: PipelineApi }) {
  const { state, reload, replace } = useLoad(async () => {
    const config = await api.getConfig(project.id)
    const runs = config ? await api.listRuns(project.id) : []
    const latest = runs[0] ? await api.getRun(project.id, runs[0].id) : null
    return { config, latest }
  }, [project.id])
  const config = state.status === 'ready' ? state.data.config : null
  // The draft is created from the loaded configuration and recreated after each save.
  const [draftState, setDraftState] = useState<{ source: PipelineConfig; draft: Draft } | null>(null)
  const draft = config ? (draftState?.source === config ? draftState.draft : toDraft(config)) : null
  const [branchList, setBranchList] = useState<{ repository: string; items: GitHubBranch[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Branch options follow the repository field (debounced while typing).
  const repository = draft?.repository.trim() ?? ''
  const branches = branchList?.repository === repository ? branchList.items : null
  useEffect(() => {
    if (!REPOSITORY.test(repository)) return
    let active = true
    const timer = window.setTimeout(() => {
      api.githubBranches(project.id, repository).then(
        (items) => { if (active) setBranchList({ repository, items }) },
        () => { if (active) setBranchList({ repository, items: [] }) },
      )
    }, 400)
    return () => { active = false; window.clearTimeout(timer) }
  }, [api, project.id, repository])

  const patch = useMemo(() => (config && draft ? changes(config, draft) : {}), [config, draft])
  const dirty = Object.keys(patch).length > 0
  const update = (values: Partial<Draft>) => {
    if (!config || !draft) return
    setDraftState({ source: config, draft: { ...draft, ...values } })
    setMessage(null)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!config || !draft || saving) return
    if (!dirty) { setMessage({ kind: 'success', text: 'No changes to save.' }); return }
    if (!draft.name.trim()) { setMessage({ kind: 'error', text: 'Pipeline name is required.' }); return }
    if (!REPOSITORY.test(draft.repository.trim())) { setMessage({ kind: 'error', text: 'Repository must be a GitHub "owner/repo" name.' }); return }
    if (branches && !branches.some((item) => item.name === draft.branch)) { setMessage({ kind: 'error', text: 'Select a branch that exists in the repository.' }); return }
    setSaving(true)
    try {
      const saved = await api.updateConfig(project.id, patch)
      replace({ config: saved, latest: state.status === 'ready' ? state.data.latest : null })
      setMessage({ kind: 'success', text: 'Configuration saved. New runs use these settings.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not save the configuration.' })
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <PageHeader crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: 'Pipeline Configuration' }]} title="Pipeline Configuration"
      subtitle="Configure the CI pipeline for this project."
      actions={draft && <button type="submit" form="pipeline-config-form" className="pr-primary-button pr-primary-button--wide" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save configuration'}</button>} />
  )

  return (
    <section className="pr-page pr-page--config" aria-labelledby="pipeline-config-title">
      <Link className="pr-link pr-back-link" to={pipelineRunsPath(routeId)}><span aria-hidden="true">←</span> Back</Link>
      {header}
      {state.status === 'loading' && <div className="pr-card" aria-busy="true"><span className="pr-skeleton pr-skeleton--wide" /><span className="pr-skeleton" /></div>}
      {state.status === 'error' && <StateMessage role="alert" title="Couldn’t load the configuration" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />}
      {state.status === 'ready' && !config && (
        <StateMessage title="No pipeline configured" body={`${project.name} has no pipeline yet.`} action={<Link className="pr-primary-button" to={setupRepositoryPath(routeId)}>Connect repository →</Link>} />
      )}
      {state.status === 'ready' && config && draft && (
        <>
          {state.data.latest && <RunProvenance run={state.data.latest} />}
          {message && <p className={message.kind === 'error' ? 'pr-form-error' : 'pr-notice'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <div className="pr-config">
            <nav className="pr-card pr-config__nav" aria-label="Configuration sections">
              <ul>{SECTIONS.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}</ul>
            </nav>
            <form id="pipeline-config-form" className="pr-config__grid" onSubmit={submit} noValidate>
              <section className="pr-card" id="cfg-general" aria-labelledby="cfg-general-title">
                <h2 id="cfg-general-title" className="pr-card__subtitle">General</h2>
                <fieldset className="pr-fieldset" disabled={saving}>
                <label className="pr-label" htmlFor="cfg-name">Pipeline name</label>
                <input id="cfg-name" className="pr-control pr-control--block" value={draft.name} maxLength={120} onChange={(event) => update({ name: event.target.value })} />
                </fieldset>
              </section>

              <section className="pr-card" id="cfg-repository" aria-labelledby="cfg-repository-title">
                <h2 id="cfg-repository-title" className="pr-card__subtitle">Repository</h2>
                <fieldset className="pr-fieldset" disabled={saving}>
                <label className="pr-label" htmlFor="cfg-repo">Repository</label>
                <input id="cfg-repo" className="pr-control pr-control--block" value={draft.repository} spellCheck={false} onChange={(event) => update({ repository: event.target.value })} aria-describedby="cfg-repo-help" />
                <p id="cfg-repo-help" className="pr-help">GitHub “owner/repo”. Checked against GitHub when saved.</p>
                <label className="pr-label" htmlFor="cfg-branch">Default branch</label>
                <select id="cfg-branch" className="pr-control pr-control--select pr-control--block" value={draft.branch} onChange={(event) => update({ branch: event.target.value })}>
                  {!branches?.some((item) => item.name === draft.branch) && <option value={draft.branch}>{draft.branch || 'Select a branch'}</option>}
                  {branches?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <div className="pr-checkboxes pr-checkboxes--small" role="group" aria-label="Pipeline triggers">
                  {([['push', 'Push to main'], ['pull_request', 'Pull requests'], ['tag', 'Tags']] as [PipelineTrigger, string][]).map(([value, label]) => (
                    <label key={value}><input type="checkbox" checked={draft.triggers.includes(value)}
                      onChange={(event) => update({ triggers: event.target.checked ? [...draft.triggers, value] : draft.triggers.filter((item) => item !== value) })} /> {label}</label>
                  ))}
                </div>
                <p className="pr-help">Automatic triggers take effect once repository webhooks are connected; until then runs are started manually.</p>
                </fieldset>
              </section>

              <section className="pr-card" id="cfg-build" aria-labelledby="cfg-build-title">
                <h2 id="cfg-build-title" className="pr-card__subtitle">Build &amp; Test</h2>
                <fieldset className="pr-fieldset" disabled={saving}>
                <label className="pr-label" htmlFor="cfg-build-cmd">Build command</label>
                <input id="cfg-build-cmd" className="pr-control pr-control--block" value={draft.buildCommand} spellCheck={false} disabled={!draft.build} onChange={(event) => update({ buildCommand: event.target.value })} />
                <label className="pr-label" htmlFor="cfg-test-cmd">Test command</label>
                <input id="cfg-test-cmd" className="pr-control pr-control--block" value={draft.testCommand} spellCheck={false} disabled={!draft.test} onChange={(event) => update({ testCommand: event.target.value })} />
                <div className="pr-checkboxes pr-checkboxes--small">
                  <label><input type="checkbox" checked={draft.build} onChange={(event) => update({ build: event.target.checked })} /> Build contracts</label>
                  <label><input type="checkbox" checked={draft.test} onChange={(event) => update({ test: event.target.checked })} /> Run tests</label>
                </div>
                <p className="pr-help">Commands run in an isolated container for the exact commit. Empty fields use the {draft.framework} defaults.</p>
                </fieldset>
              </section>

              <section className="pr-card" id="cfg-security" aria-labelledby="cfg-security-title">
                <h2 id="cfg-security-title" className="pr-card__subtitle">Security Analysis</h2>
                <fieldset className="pr-fieldset" disabled={saving}>
                <label className="pr-checkbox-large"><input type="checkbox" checked={draft.slither} onChange={(event) => update({ slither: event.target.checked })} /> Enable Slither</label>
                <label className="pr-label" htmlFor="cfg-slither">Slither config</label>
                <input id="cfg-slither" className="pr-control pr-control--block" value={draft.slitherConfig} placeholder="slither.config.json" spellCheck={false} disabled={!draft.slither} onChange={(event) => update({ slitherConfig: event.target.value })} />
                <p className="pr-help">Blocking rules such as “Block high-severity findings” are set in the project’s security policy. <Link className="pr-link" to={`/projects/${encodeURIComponent(routeId)}/security`}>Open Security</Link></p>
                </fieldset>
              </section>

              <section className="pr-card" id="cfg-environment" aria-labelledby="cfg-env-title">
                <h2 id="cfg-env-title" className="pr-card__subtitle">Environment Variables</h2>
                <p className="pr-help">Build and deployment variables (for example <code>SEPOLIA_RPC_URL</code>, <code>PRIVATE_KEY</code>) are managed in Environment Variables. Values are never shown or stored by the pipeline configuration, and build containers receive no secrets.</p>
              </section>

              <section className="pr-card" id="cfg-advanced" aria-labelledby="cfg-advanced-title">
                <h2 id="cfg-advanced-title" className="pr-card__subtitle">Advanced</h2>
                <fieldset className="pr-fieldset" disabled={saving}>
                <label className="pr-label" htmlFor="cfg-framework">Framework</label>
                <select id="cfg-framework" className="pr-control pr-control--select pr-control--block" value={draft.framework} onChange={(event) => update({ framework: event.target.value as PipelineFramework })}>
                  <option value="hardhat">Hardhat</option><option value="foundry">Foundry</option><option value="other">Other</option>
                </select>
                <p className="pr-help">Selects the build image and default commands.</p>
                </fieldset>
              </section>
            </form>
          </div>
        </>
      )}
    </section>
  )
}
