import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../../../app/api/client'
import { platformApi, ROLE_DESCRIPTIONS, ROLE_LABELS, type Environment, type Invitation, type Notification, type Overview, type Project, type Role, type SentInvitation, type Variable } from '../../../app/api/platform'
import { useLoad } from '../../../app/hooks/useLoad'
import { useShell } from '../../../app/shell/shellState'
import projectCube from '../../../app/shell/icons/project-cube.svg'
import { LoadError, LoadingCard, PageHeader, ProjectSetupSteps, StateMessage } from '../../../app/ui'
import { formatDate, formatDateTime } from '../../../app/format'
import { pipelineApi } from '../../pipelines/services/pipelineApi'
import type { PipelineConfig } from '../../pipelines/types/pipelineRun'
import '../../../app/ui.css'
import '../platform.css'

const ROLES: Role[] = ['owner', 'developer', 'reviewer', 'viewer']
const INVITE_ROLES: Role[] = ['developer', 'reviewer', 'viewer', 'owner']
const FRAMEWORKS = [{ value: 'hardhat', label: 'Hardhat' }, { value: 'foundry', label: 'Foundry' }, { value: 'other', label: 'Other' }]
const FRAMEWORK_LABEL: Record<string, string> = { hardhat: 'Hardhat', foundry: 'Foundry', other: 'Other' }
const NETWORKS = [
  { value: 'hardhat-local', label: 'Local Hardhat', chainId: 31337 }, { value: 'sepolia', label: 'Sepolia Testnet', chainId: 11155111 },
  { value: 'holesky', label: 'Holesky Testnet', chainId: 17000 }, { value: 'ethereum-mainnet', label: 'Ethereum Mainnet', chainId: 1 }, { value: 'custom', label: 'Custom network', chainId: 0 },
]
const networkLabel = (value: string) => NETWORKS.find((n) => n.value === value)?.label ?? value
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const projectPath = (project: Pick<Project, 'slug'>, page: string) => `/projects/${project.slug}/${page}`

/** Renders project pages once the shell has resolved the route project. */
function WithProject({ children }: { children: (project: Project) => ReactNode }) {
  const { project, projectStatus, projectError, refreshProject } = useShell()
  if (projectStatus === 'loading' || projectStatus === 'none') return <section className="co-page"><LoadingCard label="project" /></section>
  if (!project) return <section className="co-page"><LoadError code={projectError?.includes('not found') ? 404 : 0} message={projectError ?? 'Project not found'} what="Project" onRetry={refreshProject} /></section>
  return <>{children(project)}</>
}

// ---------- Frame 11: Project details (wizard step 1) ----------

export function ProjectDetailsPage() {
  const { projectId } = useParams()
  // /projects/new creates the project; /projects/:id/setup/details edits a project still in setup.
  return projectId ? <WithProject>{(project) => <ProjectDetailsForm project={project} />}</WithProject> : <ProjectDetailsForm project={null} />
}

function ProjectDetailsForm({ project }: { project: Project | null }) {
  const navigate = useNavigate()
  const { organization, refreshProject } = useShell()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [framework, setFramework] = useState(project?.framework ?? 'hardhat')
  const [branch, setBranch] = useState(project?.defaultBranch ?? 'main')
  const [errors, setErrors] = useState<{ name?: string; branch?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || !organization) return
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter a project name.'
    if (!/^[A-Za-z0-9._/-]{1,255}$/.test(branch) || branch.includes('..')) next.branch = 'Enter a valid branch name.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const body = { name: name.trim(), description: description.trim() || null, framework, defaultBranch: branch }
      const saved = project ? await platformApi.updateProject(project.id, body) : await platformApi.createProject(organization.id, body)
      if (project) refreshProject()
      navigate(`/projects/${saved.slug}/setup/repository`)
    } catch (error) {
      setErrors({ form: errorMessage(error) })
      setSaving(false)
    }
  }

  if (!organization) return <section className="co-page"><LoadingCard label="organization" /></section>
  if (!project && organization.role !== 'owner' && organization.role !== 'developer') {
    return <section className="co-page"><StateMessage role="alert" title="You can’t create projects" body={`Your role in ${organization.name} is ${ROLE_LABELS[organization.role]}. Owners and Developers can create projects.`} action={<Link className="co-btn co-btn--outline" to="/projects">Back to projects</Link>} /></section>
  }
  return (
    <section className="co-page" aria-labelledby="project-details-title">
      <PageHeader titleId="project-details-title" back="/projects" crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: 'Create a new project' }]}
        title="Create a new project" subtitle="Set up your project details to get started with smart contract development." />
      <div className="co-setup">
        <ProjectSetupSteps current={0} />
        <form className="co-card co-setup__card" onSubmit={submit} noValidate>
          <fieldset className="co-fieldset" disabled={saving}>
            <legend className="co-card__title">Project details</legend>
            <label className="co-label" htmlFor="project-name">Project name *</label>
            <input id="project-name" className="co-control" value={name} maxLength={120} placeholder="ChainVault" aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} />
            {errors.name && <p className="co-field-error">{errors.name}</p>}
            <label className="co-label" htmlFor="project-description">Description</label>
            <input id="project-description" className="co-control" value={description} maxLength={500} placeholder="Upgradeable multi-sig treasury with governance controls." onChange={(event) => setDescription(event.target.value)} />
            <label className="co-label" htmlFor="project-framework">Smart contract framework</label>
            <select id="project-framework" className="co-control" value={framework} onChange={(event) => setFramework(event.target.value)}>
              {FRAMEWORKS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <label className="co-label" htmlFor="project-branch">Default branch</label>
            <input id="project-branch" className="co-control" value={branch} maxLength={255} aria-invalid={Boolean(errors.branch)} onChange={(event) => setBranch(event.target.value)} />
            {errors.branch && <p className="co-field-error">{errors.branch}</p>}
            {errors.form && <p className="co-error-box" role="alert">{errors.form}</p>}
            <div className="co-actions">
              <Link className="co-btn co-btn--outline co-btn--wide" to="/projects"><span aria-hidden="true">←</span> Back</Link>
              <button type="submit" className="co-btn co-btn--primary co-btn--wizard">{saving ? 'Saving…' : <>Continue to repository <span aria-hidden="true">→</span></>}</button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  )
}

// ---------- Frame 12: Invite your team (wizard step 4) ----------

function useTeamInvites(project: Project) {
  const { state, reload, refresh } = useLoad(() => platformApi.team(project.id), [project.id])
  return { state, reload, refresh }
}

function InvitationTable({ invitations, statusLabel, onRemove }: { invitations: Invitation[]; statusLabel: (i: Invitation) => string; onRemove?: (i: Invitation) => void }) {
  return (
    <div className="co-table-wrap">
      <table className="co-table co-table--plain">
        <thead><tr><th scope="col">Email</th><th scope="col">Project role</th><th scope="col">Status</th>{onRemove && <th scope="col"><span className="co-visually-hidden">Actions</span></th>}</tr></thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td>{invitation.email}</td>
              <td className="co-text-link">{ROLE_LABELS[invitation.role]}</td>
              <td className="co-text-warning">{statusLabel(invitation)}</td>
              {onRemove && <td><button type="button" className="co-text-button" onClick={() => onRemove(invitation)} aria-label={`Remove ${invitation.email}`}>Remove</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TeamStepPage() {
  return <WithProject>{(project) => <TeamStep project={project} />}</WithProject>
}

function TeamStep({ project }: { project: Project }) {
  const { state, reload, refresh } = useTeamInvites(project)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('developer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const invitations = state.status === 'ready' ? state.data.invitations : []

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!EMAIL.test(email.trim())) { setError('Enter a valid email address.'); return }
    setBusy(true); setError(null)
    try { await platformApi.inviteToProject(project.id, email.trim(), role); setEmail(''); refresh() }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  const remove = async (invitation: Invitation) => {
    try { await platformApi.revokeProjectInvitation(project.id, invitation.id); refresh() }
    catch (failure) { setError(errorMessage(failure)) }
  }

  return (
    <section className="co-page" aria-labelledby="team-step-title">
      <PageHeader titleId="team-step-title" back={projectPath(project, 'setup/pipeline')} crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: project.name }, { label: 'Team' }]} crumbStyle="slash"
        title="Invite your team" subtitle="Step 4 of 5 · Assign a project role before sending each invitation." />
      <div className="co-setup">
        <ProjectSetupSteps current={3} />
        <div className="co-card co-setup__card">
          {!project.access.canManage && <p className="co-notice">Only the project Owner can invite teammates.</p>}
          <form onSubmit={add} noValidate className="co-fieldset">
            <h2 className="co-card__title">Invite by email</h2>
            <p className="co-help">You remain the project Owner. Each invited person gets their own project role; invitations are sent when the project is created.</p>
            <label className="co-label" htmlFor="team-email">Email address</label>
            <input id="team-email" type="email" className="co-control" placeholder="alex@team.example" value={email} disabled={busy || !project.access.canManage} onChange={(event) => { setEmail(event.target.value); setError(null) }} />
            <label className="co-label" htmlFor="team-role">Project role *</label>
            <select id="team-role" className="co-control" value={role} disabled={busy || !project.access.canManage} onChange={(event) => setRole(event.target.value as Role)}>
              {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <p className="co-help">{ROLE_DESCRIPTIONS[role]}</p>
            <div className="co-actions co-actions--start"><button type="submit" className="co-btn co-btn--outline" disabled={busy || !project.access.canManage || !email.trim()}>{busy ? 'Adding…' : '+ Add to invitation list'}</button></div>
          </form>
          {error && <p className="co-error-box" role="alert">{error}</p>}
          <h2 className="co-card__title">Team invitation list · {invitations.length} member{invitations.length === 1 ? '' : 's'}</h2>
          {state.status === 'loading' && <span className="co-skeleton" />}
          {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Team" onRetry={reload} />}
          {state.status === 'ready' && (invitations.length
            ? <InvitationTable invitations={invitations} statusLabel={(i) => (i.status === 'draft' ? 'Ready to invite' : 'Pending invitation')} onRemove={project.access.canManage ? (i) => void remove(i) : undefined} />
            : <p className="co-help">No invitations yet. You can also invite people later from Team Info.</p>)}
          <p className="co-help">Existing users sign in. New users create an account. Project access activates only after the invitation is accepted.</p>
          <div className="co-actions co-actions--start">
            <Link className="co-btn co-btn--primary co-btn--wizard" to={projectPath(project, 'setup/review')}>Continue to review</Link>
            <Link className="co-btn co-btn--outline" to={projectPath(project, 'setup/pipeline')}>Back</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Frame 13: Review project & team (wizard step 5) ----------

export function ReviewStepPage() {
  return <WithProject>{(project) => <ReviewStep project={project} />}</WithProject>
}

function ReviewStep({ project }: { project: Project }) {
  const navigate = useNavigate()
  const { refreshProject } = useShell()
  const { state, reload } = useLoad(async () => ({ team: await platformApi.team(project.id), config: await pipelineApi.getConfig(project.id) as PipelineConfig | null }), [project.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<SentInvitation[] | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const owner = data?.team.members.find((m) => m.role === 'owner')
  const stages = data?.config ? (['build', 'test', 'slither'] as const).filter((s) => (data.config!.stages as string[]).includes(s) || (s === 'build' && (data.config!.stages as string[]).includes('compile'))) : []
  const triggers = data?.config?.triggers ?? []
  const triggerText = triggers.length === 0 ? 'Manual runs' : triggers.map((t) => (t === 'push' ? 'Push' : t === 'pull_request' ? 'pull requests' : 'tags')).join(' / ')

  const create = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await platformApi.completeSetup(project.id)
      refreshProject()
      if (result.invitations.some((i) => i.delivery === 'link')) { setSent(result.invitations); setBusy(false) }
      else navigate(projectPath(project, 'dashboard'))
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }

  if (project.setupComplete && !sent) {
    return <section className="co-page"><StateMessage title={`${project.name} is already created`} body="Project setup is complete." action={<Link className="co-btn co-btn--primary" to={projectPath(project, 'dashboard')}>Open dashboard</Link>} /></section>
  }
  return (
    <section className="co-page" aria-labelledby="review-title">
      <PageHeader titleId="review-title" back={projectPath(project, 'setup/team')} crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: project.name }, { label: 'Team' }]} crumbStyle="slash"
        title="Review project & team" subtitle="Step 5 of 5 · Confirm project details and assigned team roles." />
      <div className="co-setup">
        <ProjectSetupSteps current={4} />
        <div className="co-card co-setup__card">
          {state.status === 'loading' && <><span className="co-skeleton co-skeleton--title" /><span className="co-skeleton" /></>}
          {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Project" onRetry={reload} />}
          {sent ? (
            <>
              <h2 className="co-card__heading">{project.name} is ready</h2>
              <p className="co-help">Email delivery is not configured, so share each invitation link with its recipient. Links are shown once.</p>
              <ul className="co-link-list">{sent.map((s) => <li key={s.invitation.id}><strong>{s.invitation.email}</strong> · {ROLE_LABELS[s.invitation.role]}<br /><code className="co-invite-link">{s.inviteLink}</code></li>)}</ul>
              <div className="co-actions co-actions--start"><Link className="co-btn co-btn--primary" to={projectPath(project, 'dashboard')}>Open dashboard</Link></div>
            </>
          ) : data && (
            <>
              <h2 className="co-card__heading">Ready to create {project.name}</h2>
              {data.config ? (
                <p className="co-review-summary">
                  {data.config.repository} · {FRAMEWORK_LABEL[project.framework] ?? project.framework} · {data.config.branch}<br />
                  Pipeline: {stages.map((s, i) => <span key={s}>{i > 0 && <span aria-hidden="true"> → </span>}{s === 'build' ? 'Build' : s === 'test' ? 'Test' : 'Slither'}</span>)} · {triggerText}
                </p>
              ) : <p className="co-error-box">The repository and pipeline are not configured yet. <Link className="co-link" to={projectPath(project, 'setup/repository')}>Connect repository</Link></p>}
              <p className="co-card__title">Project Owner · {owner?.fullName ?? project.ownerName ?? 'You'}</p>
              <p className="co-card__title">Invitations to send after project creation</p>
              {data.team.invitations.length
                ? <InvitationTable invitations={data.team.invitations} statusLabel={(i) => (i.status === 'draft' ? 'Ready to invite' : 'Pending invitation')} />
                : <p className="co-help">No invitations. You can invite people later from Team Info.</p>}
              <p className="co-help">Each invite is tied to its email and assigned project role. Invitations do not grant workspace-wide administrator access.</p>
              {error && <p className="co-error-box" role="alert">{error}</p>}
              <div className="co-actions co-actions--start">
                <button type="button" className="co-btn co-btn--primary co-btn--wizard" onClick={() => void create()} disabled={busy || !data.config || !project.access.canManage}>{busy ? 'Creating…' : data.team.invitations.length ? 'Create project & send invites' : 'Create project'}</button>
                <Link className="co-btn co-btn--outline co-btn--wide" to={projectPath(project, 'setup/team')}>Back to team</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- Frame 15: Project dashboard ----------

type DashboardTab = 'overview' | 'pipelines' | 'contracts' | 'security' | 'settings' | 'releases' | 'approvals'
const DASHBOARD_TABS: { key: DashboardTab; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'pipelines', label: 'Pipelines' }, { key: 'contracts', label: 'Contracts' }, { key: 'security', label: 'Security' },
  { key: 'settings', label: 'Settings' }, { key: 'releases', label: 'Releases' }, { key: 'approvals', label: 'Approvals' },
]
const RUN_TEXT: Record<string, { glyph: string; label: string; tone: string }> = {
  success: { glyph: '✓', label: 'Passed', tone: 'co-text-success' }, failed: { glyph: '△', label: 'Failed', tone: 'co-text-danger' }, error: { glyph: '△', label: 'Error', tone: 'co-text-warning' },
  cancelled: { glyph: '○', label: 'Cancelled', tone: 'co-text-link' }, running: { glyph: '◉', label: 'Running', tone: 'co-text-link' }, queued: { glyph: '○', label: 'Queued', tone: 'co-text-link' },
}
const duration = (seconds: number | null) => (seconds === null ? '—' : seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`)

export function ProjectDashboardPage() {
  return <WithProject>{(project) => <Dashboard project={project} />}</WithProject>
}

function Dashboard({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams()
  const tab = (DASHBOARD_TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview')
  const { state, reload } = useLoad(() => platformApi.overview(project.id), [project.id])
  if (!project.setupComplete) {
    return <section className="co-page"><StateMessage title={`${project.name} is still being set up`} body="Finish the project creation steps to open the dashboard." action={<Link className="co-btn co-btn--primary" to={projectPath(project, 'setup/repository')}>Continue setup</Link>} /></section>
  }
  const data = state.status === 'ready' ? state.data : null
  const network = data?.environments[0]
  return (
    <section className="co-page" aria-labelledby="dashboard-title">
      <PageHeader titleId="dashboard-title" crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: project.name }]} title={project.name} subtitle="Project overview · Repository, pipeline results and deployment evidence." />
      <div className="co-project-identity">
        <img src={projectCube} width={40} height={40} alt="" />
        <div>
          <span className={`co-pill${project.status === 'active' ? '' : ' co-pill--muted'}`}>{project.status[0].toUpperCase() + project.status.slice(1)}</span>
          <p className="co-project-identity__meta">{[data?.repository?.repository ?? 'No repository', FRAMEWORK_LABEL[project.framework] ?? project.framework, data?.repository?.branch ?? project.defaultBranch, network ? networkLabel(network.network) : null].filter(Boolean).join('  ·  ')}</p>
        </div>
      </div>
      <div className="co-dashboard-tabs" role="tablist" aria-label="Project overview sections">
        {DASHBOARD_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : undefined} onClick={() => setParams(t.key === 'overview' ? {} : { tab: t.key }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      {state.status === 'loading' && <LoadingCard label="overview" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Overview" onRetry={reload} />}
      {data && <DashboardContent project={project} data={data} tab={tab} />}
    </section>
  )
}

function DashboardContent({ project, data, tab }: { project: Project; data: Overview; tab: DashboardTab }) {
  const run = data.latestRun
  const stage = (key: string) => run?.stages.find((s) => s.key === key)?.status
  const build = run ? (stage('build') === 'success' && stage('test') !== 'failed' ? 'success' : stage('build') === 'failed' || stage('test') === 'failed' ? 'failed' : run.status) : null
  const statusCell = (status: string | null | undefined, emptyLabel: string) => {
    if (!status) return <span className="co-text-link">○ {emptyLabel}</span>
    const text = RUN_TEXT[status] ?? { glyph: '○', label: status, tone: 'co-text-link' }
    return <span className={text.tone}>{text.glyph} {text.label}</span>
  }
  const approval = data.approvals.pending > 0 ? <span className="co-text-link">◉ Waiting</span> : data.approvals.latestStatus ? <span className="co-text-link">✓ {data.approvals.latestStatus.toLowerCase()}</span> : <span className="co-text-link">○ None requested</span>
  const recentRuns = (
    <div className="co-card co-dashboard-runs">
      <div className="co-card__row"><h2 className="co-card__title">Recent pipeline runs</h2><Link className="co-link" to={projectPath(project, 'pipelines')}>View all <span aria-hidden="true">→</span></Link></div>
      {data.recentRuns.length === 0 ? <p className="co-help">No pipeline runs yet. <Link className="co-link" to={projectPath(project, 'pipelines/new')}>Run the pipeline</Link></p> : (
        <table className="co-table co-table--plain co-table--compact">
          <thead className="co-visually-hidden"><tr><th>Run</th><th>Commit</th><th>Status</th><th>Duration</th><th>Date</th></tr></thead>
          <tbody>{data.recentRuns.map((r) => (
            <tr key={r.id}><td><Link className="co-link" to={projectPath(project, `pipelines/${r.id}`)}>r{r.runNumber}</Link></td><td>{r.commitSha.slice(0, 7)}</td><td>{statusCell(r.status, '')}</td><td>{duration(r.durationSeconds)}</td><td>{formatDate(r.queuedAt)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
  const maxRuns = Math.max(1, ...data.activity.map((a) => a.runs))
  const activity = (
    <div className="co-card">
      <h2 className="co-card__title">Latest deployment</h2>
      <p className="co-help">Deployment records come from the Deployments module (M2), which is not connected to this dashboard yet.</p>
      {data.contracts.latest && <p className="co-help">Latest registered contract · {data.contracts.latest}</p>}
      <h2 className="co-card__title">Activity (last 14 days)</h2>
      <div className="co-activity" role="img" aria-label={`Pipeline runs per day over the last 14 days: ${data.activity.reduce((sum, a) => sum + a.runs, 0)} in total`}>
        {data.activity.map((a) => <span key={a.day} title={`${a.day}: ${a.runs} run${a.runs === 1 ? '' : 's'}`} style={{ height: `${Math.max(4, (a.runs / maxRuns) * 64)}px` }} className={a.runs ? undefined : 'is-empty'} />)}
      </div>
    </div>
  )

  if (tab === 'pipelines') return recentRuns
  if (tab === 'contracts') return <div className="co-card"><h2 className="co-card__title">Contract registry</h2><p className="co-help">{data.contracts.artifacts} registered artifact{data.contracts.artifacts === 1 ? '' : 's'}{data.contracts.latest ? ` · latest ${data.contracts.latest}` : ''}.</p><Link className="co-link" to={projectPath(project, 'contracts')}>Open Contract Registry →</Link></div>
  if (tab === 'security') return <div className="co-card"><h2 className="co-card__title">Security</h2><p className="co-help">{data.security.policies} security polic{data.security.policies === 1 ? 'y' : 'ies'} configured. Latest run Slither stage: {stage('slither') ?? 'not run'}.</p><Link className="co-link" to={projectPath(project, 'security')}>Open Security Scans →</Link></div>
  if (tab === 'approvals') return <div className="co-card"><h2 className="co-card__title">Approvals</h2><p className="co-help">{data.approvals.total} approval request{data.approvals.total === 1 ? '' : 's'}, {data.approvals.pending} pending{data.approvals.latestTitle ? ` · latest: ${data.approvals.latestTitle}` : ''}.</p></div>
  if (tab === 'releases') return <div className="co-card"><h2 className="co-card__title">Releases</h2><p className="co-help">Release records are produced by the Release (CD) pipeline (M2) and are not connected yet.</p><Link className="co-link" to={projectPath(project, 'deployments')}>Open Release (CD) Pipelines →</Link></div>
  if (tab === 'settings') return <div className="co-card"><h2 className="co-card__title">Project settings</h2><p className="co-help">{project.description ?? 'No description.'} Default branch {project.defaultBranch}. {data.environments.length} environment{data.environments.length === 1 ? '' : 's'}.</p><Link className="co-link" to={projectPath(project, 'settings')}>Open Settings →</Link></div>

  return (
    <>
      <p className="co-context-strip">
        <span>Release context</span>
        {run ? <><Link className="co-link" to={projectPath(project, `pipelines/${run.id}`)}>commit {run.commitSha.slice(0, 7)}</Link><Link className="co-link" to={projectPath(project, `pipelines/${run.id}`)}>run #{run.runNumber}</Link></> : <span>no runs yet</span>}
        {data.contracts.latest && <span>{data.contracts.latest}</span>}
        {data.environments[0] && <span>{networkLabel(data.environments[0].network)}</span>}
      </p>
      <div className="co-dashboard-grid">
        <div className="co-card">
          <h2 className="co-card__title">Release summary</h2>
          <p className="co-help">{run ? `Current status for the latest run (#${run.runNumber}).` : 'No pipeline run yet.'}</p>
          <div className="co-status-grid">
            <div><span>Build</span>{statusCell(build, 'Not started')}</div>
            <div><span>Scan</span>{statusCell(stage('slither') === 'skipped' ? null : stage('slither'), stage('slither') === 'skipped' ? 'Not run' : 'Not started')}</div>
            <div><span>Approval</span>{approval}</div>
            <div><span>Deploy</span><span className="co-text-link">○ Not started</span></div>
          </div>
        </div>
        <div className="co-card">
          {data.approvals.pending > 0 ? (
            <><h2 className="co-card__title co-text-warning">Pending review</h2><p className="co-subtitle">{data.approvals.latestTitle ?? 'An approval is waiting for review.'}</p><Link className="co-btn co-btn--outline co-btn--wide co-self-start" to={projectPath(project, 'security')}>Review release <span aria-hidden="true">→</span></Link></>
          ) : (
            <><h2 className="co-card__title">No pending review</h2><p className="co-subtitle">Approval requests for this project appear here.</p></>
          )}
        </div>
        {recentRuns}
        {activity}
      </div>
    </>
  )
}

// ---------- Frame 05: Project settings ----------

export function ProjectSettingsPage() {
  return <WithProject>{(project) => <ProjectSettings project={project} />}</WithProject>
}

function ProjectSettings({ project }: { project: Project }) {
  const { refreshProject } = useShell()
  const [tab, setTab] = useState<'general' | 'integrations' | 'danger'>('general')
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [branch, setBranch] = useState(project.defaultBranch)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const { state: config } = useLoad(() => pipelineApi.getConfig(project.id), [project.id])
  const canManage = project.access.canManage
  const dirty = name.trim() !== project.name || (description.trim() || null) !== project.description || branch !== project.defaultBranch

  const save = async () => {
    if (!dirty || saving) return
    if (!name.trim()) { setMessage({ kind: 'error', text: 'Project name is required.' }); return }
    setSaving(true)
    try {
      await platformApi.updateProject(project.id, { name: name.trim(), description: description.trim() || null, defaultBranch: branch })
      refreshProject()
      setMessage({ kind: 'success', text: 'Project settings saved.' })
    } catch (error) { setMessage({ kind: 'error', text: errorMessage(error) }) }
    finally { setSaving(false) }
  }
  const setStatus = async (status: 'active' | 'paused' | 'archived') => {
    const verb = status === 'archived' ? 'Archive' : status === 'paused' ? 'Pause' : 'Reactivate'
    if (!window.confirm(`${verb} ${project.name}? ${status === 'archived' ? 'It stays readable but is marked archived for the whole organization.' : ''}`)) return
    setSaving(true)
    try { await platformApi.updateProject(project.id, { status }); refreshProject(); setMessage({ kind: 'success', text: `Project ${status}.` }) }
    catch (error) { setMessage({ kind: 'error', text: errorMessage(error) }) }
    finally { setSaving(false) }
  }
  const repo = config.status === 'ready' ? config.data : null

  return (
    <section className="co-page" aria-labelledby="project-settings-title">
      <PageHeader titleId="project-settings-title" crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name, to: projectPath(project, 'dashboard') }, { label: 'Settings' }]} crumbStyle="link"
        title="Project Settings" subtitle="Manage project configuration, integrations and preferences."
        actions={canManage ? <button type="button" className="co-btn co-btn--primary co-btn--wide" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button> : undefined} />
      <ProjectSettingsTabs project={project} current="settings" />
      <div className="co-tabs" role="tablist" aria-label="Settings sections">
        {([['general', 'General'], ['integrations', 'Integrations'], ['danger', 'Danger zone']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`co-tab co-tab--small${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {!canManage && <p className="co-notice">You can view these settings. Only the project Owner or an organization Owner can change them.</p>}
      {message && <p className={message.kind === 'error' ? 'co-error-box' : 'co-notice co-notice--success'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {tab === 'general' && (
        <div className="co-grid co-grid--2">
          <fieldset className="co-card co-fieldset" disabled={!canManage || saving}>
            <legend className="co-visually-hidden">Project details</legend>
            <h2 className="co-card__title">Project Details</h2>
            <label className="co-label" htmlFor="ps-name">Project name</label>
            <input id="ps-name" className="co-control" value={name} maxLength={120} onChange={(event) => { setName(event.target.value); setMessage(null) }} />
            <label className="co-label" htmlFor="ps-description">Description</label>
            <textarea id="ps-description" className="co-control" value={description} maxLength={500} onChange={(event) => { setDescription(event.target.value); setMessage(null) }} />
            <label className="co-label" htmlFor="ps-branch">Default branch</label>
            <input id="ps-branch" className="co-control" value={branch} maxLength={255} onChange={(event) => { setBranch(event.target.value); setMessage(null) }} />
            <p className="co-help">Branch used for deployments and CI/CD runs.</p>
          </fieldset>
          <RepositoryCard project={project} repository={repo?.repository ?? null} />
        </div>
      )}
      {tab === 'integrations' && <div className="co-grid co-grid--2"><RepositoryCard project={project} repository={repo?.repository ?? null} /></div>}
      {tab === 'danger' && (
        <div className="co-card co-danger">
          <h2 className="co-card__title">Project status</h2>
          <p className="co-help">Current status: <strong className="co-text-primary">{project.status}</strong>. Pausing or archiving keeps all data; pipelines and history remain readable.</p>
          {canManage ? (
            <div className="co-actions co-actions--start">
              {project.status !== 'paused' && <button type="button" className="co-btn co-btn--outline" disabled={saving} onClick={() => void setStatus('paused')}>Pause project</button>}
              {project.status !== 'archived' && <button type="button" className="co-btn co-btn--danger co-btn--danger-large" disabled={saving} onClick={() => void setStatus('archived')}>Archive project</button>}
              {project.status !== 'active' && <button type="button" className="co-btn co-btn--primary" disabled={saving} onClick={() => void setStatus('active')}>Reactivate</button>}
            </div>
          ) : <p className="co-help">Only owners can change the project status.</p>}
        </div>
      )}
    </section>
  )
}

function RepositoryCard({ project, repository }: { project: Project; repository: string | null }) {
  return (
    <div className="co-card">
      <h2 className="co-card__title">Repository</h2>
      <p className="co-text-primary co-repo-provider">GitHub</p>
      {repository ? <p className="co-text-success">Connected to {repository}</p> : <p className="co-text-warning">No repository connected</p>}
      <p className="co-help">Webhooks are not configured; pipeline runs are started manually. Commands and checks are managed in the pipeline configuration.</p>
      <div className="co-actions co-actions--start">
        <Link className="co-btn co-btn--outline" to={projectPath(project, repository ? 'pipelines/configuration' : 'setup/repository')}>{repository ? 'Change' : 'Connect repository'}</Link>
      </div>
    </div>
  )
}

function ProjectSettingsTabs({ project, current }: { project: Project; current: 'settings' | 'environments' | 'team' | 'notifications' }) {
  const tabs = [['settings', 'Project Settings', 'settings'], ['environments', 'Environments', 'environments'], ['team', 'People & Roles', 'team'], ['notifications', 'Notifications', 'notifications']] as const
  return (
    <nav className="co-tabs" aria-label="Project management">
      {tabs.map(([key, label, page]) => <Link key={key} className={`co-tab${current === key ? ' is-active' : ''}`} aria-current={current === key ? 'page' : undefined} to={projectPath(project, page)}>{label}</Link>)}
    </nav>
  )
}

// ---------- Frame 16: Environments ----------

export function EnvironmentsPage() {
  return <WithProject>{(project) => <Environments project={project} />}</WithProject>
}

function Environments({ project }: { project: Project }) {
  const { state, reload, refresh } = useLoad(() => platformApi.environments(project.id), [project.id])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const data = state.status === 'ready' ? state.data : null

  const check = async (env: Environment) => {
    setBusy(env.id); setError(null)
    try { await platformApi.checkEnvironment(project.id, env.id); refresh() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(null) }
  }
  const remove = async (env: Environment) => {
    if (!window.confirm(`Delete ${env.name}? Environment variables scoped to it are deleted too.`)) return
    setBusy(env.id)
    try { await platformApi.deleteEnvironment(project.id, env.id); refresh() } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(null) }
  }

  return (
    <section className="co-page" aria-labelledby="environments-title">
      <PageHeader titleId="environments-title" back={projectPath(project, 'dashboard')} crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }, { label: 'Settings' }]} crumbStyle="slash"
        title="Environments" subtitle="Configure and manage the networks used for development and deployment." />
      <ProjectSettingsTabs project={project} current="environments" />
      {state.status === 'loading' && <LoadingCard label="environments" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Environments" onRetry={reload} />}
      {error && <p className="co-error-box" role="alert">{error}</p>}
      {data && (
        <>
          {data.environments.length === 0 && !adding && <StateMessage title="No environments yet" body="Add the local Hardhat network for development and Sepolia for public testing." />}
          {data.environments.map((env) => (
            <div key={env.id} className="co-card co-environment">
              <h2 className="co-card__title">{env.name}</h2>
              <p className="co-help">{env.description ?? networkLabel(env.network)}</p>
              <p className={env.lastCheck ? (env.lastCheck.ok ? 'co-text-link' : 'co-text-danger') : 'co-help'}>{env.lastCheck ? (env.lastCheck.ok ? '● Connected' : '● Connection failed') : '○ Not checked yet'}</p>
              <dl className="co-environment__facts">
                <div><dt>Chain ID</dt><dd>{env.chainId}</dd></div>
                <div><dt>RPC URL</dt><dd>{env.rpcUrlMasked}</dd></div>
                <div><dt>Network</dt><dd>{networkLabel(env.network)}</dd></div>
              </dl>
              <p className="co-help">{env.lastCheck ? `${env.lastCheck.ok ? 'Last successful check' : 'Last check'} · ${formatDateTime(env.lastCheck.at)}${env.lastCheck.message && !env.lastCheck.ok ? ` · ${env.lastCheck.message}` : ''}` : 'Use Test connection to verify the RPC endpoint and chain id.'}</p>
              {data.canManage && (
                <div className="co-actions co-actions--start">
                  <button type="button" className="co-btn co-btn--outline co-btn--small" disabled={busy === env.id} onClick={() => void check(env)}>{busy === env.id ? 'Checking…' : 'Test connection'}</button>
                  <button type="button" className="co-btn co-btn--danger" disabled={busy === env.id} onClick={() => void remove(env)}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {data.canManage && (adding
            ? <EnvironmentForm project={project} onDone={() => { setAdding(false); refresh() }} onCancel={() => setAdding(false)} />
            : <button type="button" className="co-btn co-btn--outline co-self-start" onClick={() => setAdding(true)}>+ Add environment</button>)}
          <div className="co-card"><h2 className="co-card__title">Supported environments</h2><p className="co-subtitle">Use a local Hardhat network for development and Sepolia for public testing. RPC URLs are stored encrypted and shown masked; configure secrets in <Link className="co-link" to={projectPath(project, 'variables')}>Environment Variables</Link>.</p></div>
        </>
      )}
    </section>
  )
}

function EnvironmentForm({ project, onDone, onCancel }: { project: Project; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('Sepolia Testnet')
  const [description, setDescription] = useState('')
  const [network, setNetwork] = useState('sepolia')
  const [chainId, setChainId] = useState('11155111')
  const [rpcUrl, setRpcUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!name.trim() || !rpcUrl.trim() || !Number(chainId)) { setError('Name, chain id and RPC URL are required.'); return }
    setBusy(true); setError(null)
    try { await platformApi.createEnvironment(project.id, { name: name.trim(), description: description.trim() || null, network, chainId: Number(chainId), rpcUrl: rpcUrl.trim() }); onDone() }
    catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  return (
    <form className="co-card co-fieldset" onSubmit={submit} noValidate>
      <h2 className="co-card__title">New environment</h2>
      <div className="co-grid co-grid--2">
        <div><label className="co-label" htmlFor="env-name">Name</label><input id="env-name" className="co-control" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><label className="co-label" htmlFor="env-network">Network</label>
          <select id="env-network" className="co-control" value={network} onChange={(event) => { setNetwork(event.target.value); const known = NETWORKS.find((n) => n.value === event.target.value); if (known?.chainId) setChainId(String(known.chainId)); if (event.target.value === 'hardhat-local') { setRpcUrl('http://127.0.0.1:8545'); setName('Local Hardhat') } }}>
            {NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select></div>
        <div><label className="co-label" htmlFor="env-chain">Chain ID</label><input id="env-chain" className="co-control" inputMode="numeric" value={chainId} disabled={network !== 'custom'} onChange={(event) => setChainId(event.target.value.replace(/\D/g, ''))} /></div>
        <div><label className="co-label" htmlFor="env-rpc">RPC URL</label><input id="env-rpc" className="co-control" type="url" autoComplete="off" placeholder="https://sepolia.infura.io/v3/<key>" value={rpcUrl} onChange={(event) => setRpcUrl(event.target.value)} />
          <p className="co-help">Stored encrypted; only a masked form is shown after saving.</p></div>
      </div>
      <label className="co-label" htmlFor="env-description">Description</label>
      <input id="env-description" className="co-control" value={description} placeholder="Public test network for staging and validation." onChange={(event) => setDescription(event.target.value)} />
      {error && <p className="co-error-box" role="alert">{error}</p>}
      <div className="co-actions co-actions--start"><button type="submit" className="co-btn co-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save environment'}</button><button type="button" className="co-btn co-btn--outline" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

// ---------- Frame 17: Environment Variables ----------

export function VariablesPage() {
  return <WithProject>{(project) => <Variables project={project} />}</WithProject>
}

function Variables({ project }: { project: Project }) {
  const { state, reload, refresh } = useLoad(async () => ({ vars: await platformApi.variables(project.id), envs: await platformApi.environments(project.id) }), [project.id])
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [secret, setSecret] = useState(true)
  const [scope, setScope] = useState('')
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const canManage = data?.vars.canManage ?? false

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) { setMessage({ kind: 'error', text: 'Keys use UPPER_SNAKE_CASE, e.g. SEPOLIA_RPC_URL.' }); return }
    if (!value) { setMessage({ kind: 'error', text: 'Enter a value.' }); return }
    setBusy(true)
    try { await platformApi.createVariable(project.id, { key, value, isSecret: secret, environmentId: scope || null }); setKey(''); setValue(''); setMessage({ kind: 'success', text: `${key} saved${secret ? ' (secret — the value is no longer viewable)' : ''}.` }); refresh() }
    catch (failure) { setMessage({ kind: 'error', text: errorMessage(failure) }) }
    finally { setBusy(false) }
  }
  const replaceValue = async (variable: Variable) => {
    if (!editing?.value) return
    setBusy(true)
    try { await platformApi.updateVariable(project.id, variable.id, { value: editing.value }); setEditing(null); setMessage({ kind: 'success', text: `${variable.key} updated.` }); refresh() }
    catch (failure) { setMessage({ kind: 'error', text: errorMessage(failure) }) }
    finally { setBusy(false) }
  }
  const remove = async (variable: Variable) => {
    if (!window.confirm(`Delete ${variable.key}${variable.environmentName ? ` (${variable.environmentName})` : ''}? This cannot be undone.`)) return
    setBusy(true)
    try { await platformApi.deleteVariable(project.id, variable.id); refresh() }
    catch (failure) { setMessage({ kind: 'error', text: errorMessage(failure) }) }
    finally { setBusy(false) }
  }

  return (
    <section className="co-page" aria-labelledby="variables-title">
      <PageHeader titleId="variables-title" back={projectPath(project, 'dashboard')} crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }, { label: 'Environment Variables' }]} crumbStyle="slash"
        title="Environment Variables" subtitle="Configure project and environment variables. Values remain masked." />
      {state.status === 'loading' && <LoadingCard label="variables" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Variables" onRetry={reload} />}
      {message && <p className={message.kind === 'error' ? 'co-error-box' : 'co-notice co-notice--success'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {data && (
        <div className="co-card">
          <h2 className="co-card__title">Environment Variables</h2>
          <p className="co-help">Secret values are encrypted at rest and never shown again after saving. Build containers do not receive them.</p>
          {data.vars.variables.length === 0 && <p className="co-help">No variables yet.</p>}
          {data.vars.variables.map((variable) => (
            <div key={variable.id} className="co-variable">
              <span className="co-variable__key">{variable.key}<small>{variable.environmentName ?? 'All environments'}{variable.isSecret ? ' · secret' : ''}</small></span>
              {editing?.id === variable.id ? (
                <span className="co-variable__edit">
                  <input className="co-control" type={variable.isSecret ? 'password' : 'text'} autoComplete="off" aria-label={`New value for ${variable.key}`} value={editing.value} onChange={(event) => setEditing({ id: variable.id, value: event.target.value })} />
                  <button type="button" className="co-btn co-btn--primary co-btn--small" disabled={busy || !editing.value} onClick={() => void replaceValue(variable)}>Save</button>
                  <button type="button" className="co-btn co-btn--outline co-btn--small" onClick={() => setEditing(null)}>Cancel</button>
                </span>
              ) : (
                <span className="co-variable__value">{variable.isSecret ? variable.maskedValue : variable.value}</span>
              )}
              {canManage && editing?.id !== variable.id && (
                <span className="co-variable__actions">
                  <button type="button" className="co-text-button" onClick={() => setEditing({ id: variable.id, value: '' })}>Replace value</button>
                  <button type="button" className="co-text-button co-text-danger" onClick={() => void remove(variable)}>Delete</button>
                </span>
              )}
            </div>
          ))}
          {canManage ? (
            <form className="co-variable-form" onSubmit={add} noValidate>
              <h3 className="co-card__title">Add variable</h3>
              <div className="co-variable-form__row">
                <div><label className="co-label" htmlFor="var-key">Key</label><input id="var-key" className="co-control" placeholder="SEPOLIA_RPC_URL" value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} /></div>
                <div><label className="co-label" htmlFor="var-value">Value</label><input id="var-value" className="co-control" type={secret ? 'password' : 'text'} autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} /></div>
                <div><label className="co-label" htmlFor="var-scope">Scope</label>
                  <select id="var-scope" className="co-control" value={scope} onChange={(event) => setScope(event.target.value)}>
                    <option value="">All environments</option>
                    {data.envs.environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
                  </select></div>
              </div>
              <label className="co-checkbox"><input type="checkbox" checked={secret} onChange={(event) => setSecret(event.target.checked)} /> Secret (write-only, masked)</label>
              <div className="co-actions co-actions--start"><button type="submit" className="co-btn co-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Add variable'}</button></div>
            </form>
          ) : <p className="co-help">Only project or organization Owners can change variables.</p>}
        </div>
      )}
    </section>
  )
}

// ---------- Frame 31: Team Info ----------

export function TeamInfoPage() {
  return <WithProject>{(project) => <TeamInfo project={project} />}</WithProject>
}

function TeamInfo({ project }: { project: Project }) {
  const { state, reload, refresh } = useTeamInvites(project)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('developer')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string; link?: string | null } | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const owner = data?.members.find((m) => m.role === 'owner')
  const pending = data?.invitations.filter((i) => i.status === 'pending' || i.status === 'draft') ?? []

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!EMAIL.test(email.trim())) { setFeedback({ kind: 'error', text: 'Enter a valid email address.' }); return }
    setBusy(true)
    try {
      const sent = await platformApi.inviteToProject(project.id, email.trim(), role)
      setFeedback({ kind: 'success', text: sent.delivery === 'email' ? `Invitation emailed to ${sent.invitation.email}.` : sent.delivery === 'draft' ? `${sent.invitation.email} will be invited when setup completes.` : `Invitation created for ${sent.invitation.email}. Email delivery is not configured — share this link:`, link: sent.delivery === 'link' ? sent.inviteLink : null })
      setEmail(''); refresh()
    } catch (failure) { setFeedback({ kind: 'error', text: errorMessage(failure) }) }
    finally { setBusy(false) }
  }
  const revoke = async (invitation: Invitation) => {
    try { await platformApi.revokeProjectInvitation(project.id, invitation.id); refresh() } catch (failure) { setFeedback({ kind: 'error', text: errorMessage(failure) }) }
  }
  const changeRole = async (userId: string, next: Role) => {
    try { await platformApi.changeProjectRole(project.id, userId, next); refresh() } catch (failure) { setFeedback({ kind: 'error', text: errorMessage(failure) }) }
  }

  return (
    <section className="co-page" aria-labelledby="team-title">
      <PageHeader titleId="team-title" back={projectPath(project, 'dashboard')} crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: project.name }, { label: 'Team' }]} crumbStyle="slash"
        title="Project team" subtitle={data ? `${project.name} is ready · ${pending.length} invitation${pending.length === 1 ? '' : 's'} pending acceptance.` : undefined} />
      {state.status === 'loading' && <LoadingCard label="team" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Team" onRetry={reload} />}
      {data && (
        <div className="co-team-layout">
          <div className="co-card">
            <p className="co-card__title">Project Owner · {owner?.fullName ?? '—'} · Active</p>
            <h2 className="co-card__title">Members ({data.members.length})</h2>
            <div className="co-table-wrap"><table className="co-table co-table--plain">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Project role</th><th scope="col">Status</th></tr></thead>
              <tbody>{data.members.map((m) => (
                <tr key={m.userId}><td>{m.fullName}{m.isYou && <span className="co-help"> (you)</span>}</td><td>{m.email}</td>
                  <td>{data.canManage && !m.isYou
                    ? <select className="co-control co-select-inline" aria-label={`Project role for ${m.fullName}`} value={m.role} onChange={(event) => void changeRole(m.userId, event.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                    : <span className="co-text-link">{ROLE_LABELS[m.role]}</span>}</td>
                  <td className="co-text-link">● Active</td></tr>
              ))}</tbody>
            </table></div>
            <h2 className="co-card__title co-text-warning">Pending invitations</h2>
            {pending.length
              ? <InvitationTable invitations={pending} statusLabel={(i) => (i.status === 'draft' ? 'Sent when setup completes' : 'Pending invitation')} onRemove={data.canManage ? (i) => void revoke(i) : undefined} />
              : <p className="co-help">No pending invitations.</p>}
            <p className="co-help">Roles are reserved while pending and become active when the intended recipient accepts.</p>
            {data.canManage && (
              <form className="co-invite" onSubmit={invite} noValidate>
                <div className="co-invite__row">
                  <div><label className="co-label" htmlFor="ti-email">Invite by email</label><input id="ti-email" type="email" className="co-control" placeholder="alex@team.example" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></div>
                  <div><label className="co-label" htmlFor="ti-role">Project role *</label><select id="ti-role" className="co-control" value={role} disabled={busy} onChange={(event) => setRole(event.target.value as Role)}>{INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
                  <button type="submit" className="co-btn co-btn--primary co-invite__submit" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send invite'}</button>
                </div>
              </form>
            )}
            {feedback && <div className={feedback.kind === 'error' ? 'co-error-box' : 'co-notice co-notice--success'} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}{feedback.link && <><br /><code className="co-invite-link">{feedback.link}</code></>}</div>}
          </div>
          <aside className="co-card co-team-roles" aria-labelledby="project-roles-title">
            <h2 id="project-roles-title" className="co-card__title">Project roles</h2>
            <p className="co-subtitle">Owner controls project ownership. Every invited member receives their own project-scoped role.</p>
            <ul className="co-role-list">{ROLES.map((r) => <li key={r}><strong>{ROLE_LABELS[r]}</strong> — {ROLE_DESCRIPTIONS[r]}</li>)}</ul>
            <p className="co-help">Pending ≠ Active</p>
            <p className="co-help">Invited users cannot access this project until they accept. Revoked or expired invitations do not grant access.</p>
          </aside>
        </div>
      )}
    </section>
  )
}

// ---------- Frame 18: Notification Inbox ----------

export function NotificationsPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const { state, reload, replace } = useLoad(() => platformApi.notifications(100), [])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [menu, setMenu] = useState<string | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const items = data ? data.items.filter((n) => filter === 'all' || !n.read) : []

  const markRead = async (item: Notification) => {
    await platformApi.markNotificationRead(item.id).catch(() => undefined)
    if (data) replace({ unreadCount: Math.max(0, data.unreadCount - (item.read ? 0 : 1)), items: data.items.map((n) => (n.id === item.id ? { ...n, read: true } : n)) })
    setMenu(null)
  }
  const open = async (item: Notification) => { if (!item.read) await markRead(item); if (item.link) navigate(item.link) }
  const markAll = async () => { await platformApi.markAllNotificationsRead().catch(() => undefined); reload() }

  return (
    <section className="co-page" aria-labelledby="notifications-title">
      <PageHeader titleId="notifications-title" back={projectId ? `/projects/${projectId}/dashboard` : '/projects'} crumbs={[{ label: 'Operate' }, { label: 'Alerts' }, { label: 'Inbox' }]} crumbStyle="slash"
        title="Notification Inbox" subtitle="Stay up to date with activity across your projects." />
      <div className="co-tabs" role="tablist" aria-label="Notification filter">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`co-tab${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>All notifications</button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} className={`co-tab${filter === 'unread' ? ' is-active' : ''}`} onClick={() => setFilter('unread')}>Unread{data ? ` (${data.unreadCount})` : ''}</button>
        {data && data.unreadCount > 0 && <button type="button" className="co-text-button" onClick={() => void markAll()}>Mark all read</button>}
      </div>
      {state.status === 'loading' && <LoadingCard label="notifications" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Notifications" onRetry={reload} />}
      {data && items.length === 0 && <StateMessage title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} body="Pipeline results, invitations and team changes appear here." />}
      {items.map((item) => (
        <article key={item.id} className={`co-card co-inbox-item${item.read ? '' : ' is-unread'}`} aria-label={`${item.title}${item.read ? '' : ', unread'}`}>
          <span className="co-notification__dot" aria-hidden="true" />
          <div className="co-inbox-item__body">
            <h2 className="co-card__title">{item.title}</h2>
            <p className="co-help">{item.body}</p>
            {item.context && <p className="co-help">{item.context}</p>}
          </div>
          <div className="co-inbox-item__meta">
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC</time>
            {item.link && <button type="button" className="co-text-button" onClick={() => void open(item)}>{item.linkLabel ?? 'Open'} <span aria-hidden="true">→</span></button>}
            <div className="co-popover-root">
              <button type="button" className="co-text-button co-more" aria-haspopup="menu" aria-expanded={menu === item.id} aria-label={`More actions for ${item.title}`} onClick={() => setMenu(menu === item.id ? null : item.id)}>•••</button>
              {menu === item.id && (
                <div className="co-popover co-popover--menu" role="menu" onKeyDown={(event) => { if (event.key === 'Escape') setMenu(null) }}>
                  <button role="menuitem" type="button" className="co-menu-item" disabled={item.read} onClick={() => void markRead(item)}>{item.read ? 'Already read' : 'Mark as read'}</button>
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
