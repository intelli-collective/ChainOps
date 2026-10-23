import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../../auth/api'
import { errorMessage } from '../../../app/api/client'
import { platformApi, ROLE_DESCRIPTIONS, ROLE_LABELS, type Invitation, type Member, type MyInvitation, type Organization, type ProjectSummary, type Role, type SentInvitation } from '../../../app/api/platform'
import { useLoad } from '../../../app/hooks/useLoad'
import { NotificationsPopover, ProfileMenu } from '../../../app/shell/HeaderControls'
import { ShellProvider } from '../../../app/shell/ShellContext'
import { useShell } from '../../../app/shell/shellState'
import brandMark from '../../../app/shell/icons/brand-mark.svg'
import projectCube from '../../../app/shell/icons/project-cube.svg'
import metaRepository from '../../../app/shell/icons/meta-repository.svg'
import metaFramework from '../../../app/shell/icons/meta-framework.svg'
import metaNetwork from '../../../app/shell/icons/meta-network.svg'
import metaPipeline from '../../../app/shell/icons/meta-pipeline.svg'
import { LoadError, LoadingCard, PageHeader, StateMessage } from '../../../app/ui'
import { formatDate } from '../../../app/format'
import '../../../app/layouts/application-layout.css'
import '../../../app/ui.css'
import '../platform.css'

const ROLES: Role[] = ['owner', 'developer', 'reviewer', 'viewer']
const TEAM_SIZES = [{ value: '1', label: 'Just me' }, { value: '2-10', label: '2–10' }, { value: '11-50', label: '11–50' }, { value: '51+', label: '51+' }]
const FRAMEWORK_LABELS: Record<string, string> = { hardhat: 'Hardhat', foundry: 'Foundry', other: 'Other' }
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

/** Shown when the organization has not loaded or the user has none. */
function useOrganizationGate(): { organization: Organization | null; element: ReactNode | null } {
  const { organizations, organization } = useShell()
  if (organizations === null) return { organization: null, element: <section className="co-page"><LoadingCard label="organization" /></section> }
  if (!organization) return { organization: null, element: <Navigate to="/onboarding" replace /> }
  return { organization, element: null }
}

// ---------- Frame 06: Create organization (no app sidebar during onboarding) ----------

export function OrganizationSetupPage() {
  return (
    <ShellProvider projectRef={null}>
      <div className="co-standalone">
        <header className="co-standalone__header">
          <Link className="shell-brand" to="/"><img src={brandMark} width={28} height={28} alt="" />ChainOps</Link>
          <nav className="co-standalone__nav" aria-label="ChainOps"><Link to="/#features">Product</Link><Link to="/#workflow">Workflow</Link></nav>
          <span className="shell-header__spacer" />
          <NotificationsPopover inboxPath="/notifications" />
          <ProfileMenu />
        </header>
        <main className="co-standalone__main"><OrganizationForm /></main>
      </div>
    </ShellProvider>
  )
}

function OrganizationForm() {
  const navigate = useNavigate()
  const { organizations, refreshOrganizations, selectOrganization } = useShell()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [teamSize, setTeamSize] = useState('1')
  const [errors, setErrors] = useState<{ name?: string; slug?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)
  const effectiveSlug = slugEdited ? slug : slugify(name)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter an organization name.'
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveSlug)) next.slug = 'Use lowercase letters, numbers and single hyphens.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const created = await platformApi.createOrganization({ name: name.trim(), slug: effectiveSlug, teamSize })
      await refreshOrganizations()
      selectOrganization(created.id)
      navigate('/projects', { replace: true })
    } catch (error) {
      setErrors({ [errorMessage(error).includes('slug') ? 'slug' : 'form']: errorMessage(error) })
      setSaving(false)
    }
  }

  return (
    <form className="co-card co-org-setup" onSubmit={submit} noValidate aria-labelledby="org-setup-title">
      <h1 id="org-setup-title" className="co-card__heading">Create your organization</h1>
      <p className="co-subtitle">Set up your team’s workspace. Projects can be created afterward.</p>
      <fieldset className="co-org-setup__fields" disabled={saving}>
        <legend className="co-card__title">Organization details</legend>
        <label className="co-label" htmlFor="org-name">Organization name</label>
        <input id="org-name" className="co-control" value={name} placeholder="ChainOps Team" maxLength={120} autoFocus
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'org-name-error' : undefined} onChange={(event) => setName(event.target.value)} />
        {errors.name && <p id="org-name-error" className="co-field-error">{errors.name}</p>}
        <label className="co-label" htmlFor="org-slug">Organization slug</label>
        <input id="org-slug" className="co-control" value={effectiveSlug} placeholder="chainops-team" maxLength={80}
          aria-invalid={Boolean(errors.slug)} aria-describedby={errors.slug ? 'org-slug-error' : undefined}
          onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()) }} />
        {errors.slug && <p id="org-slug-error" className="co-field-error">{errors.slug}</p>}
        <label className="co-label" htmlFor="org-size">Team size (optional)</label>
        <select id="org-size" className="co-control" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}>
          {TEAM_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
        </select>
        {errors.form && <p className="co-error-box" role="alert">{errors.form}</p>}
        <div className="co-actions co-actions--start">
          <Link className="co-btn co-btn--outline co-btn--wide" to={organizations?.length ? '/projects' : '/'}><span aria-hidden="true">←</span> Back</Link>
          <button type="submit" className="co-btn co-btn--primary co-org-setup__submit">{saving ? 'Creating…' : <>Create organization <span aria-hidden="true">→</span></>}</button>
        </div>
      </fieldset>
    </form>
  )
}

// ---------- Frames 07 / 08: Projects (populated and empty states of one route) ----------

export function ProjectsPage() {
  const gate = useOrganizationGate()
  return gate.element ?? <ProjectsView organization={gate.organization!} />
}

function ProjectsView({ organization }: { organization: Organization }) {
  const { state, reload } = useLoad(() => platformApi.projects(organization.id), [organization.id])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ProjectSummary['status']>('all')
  const projects = useMemo(() => (state.status === 'ready' ? state.data.projects : []), [state])
  const visible = projects.filter((p) => (filter === 'all' || p.status === filter) && `${p.name} ${p.description ?? ''} ${p.repository ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const counts = { all: projects.length, active: projects.filter((p) => p.status === 'active').length, paused: projects.filter((p) => p.status === 'paused').length, archived: projects.filter((p) => p.status === 'archived').length }
  const canCreate = state.status === 'ready' && state.data.canCreate
  const empty = state.status === 'ready' && projects.length === 0

  return (
    <section className="co-page" aria-labelledby="projects-title">
      <PageHeader titleId="projects-title" crumbs={empty ? [{ label: 'Organization' }, { label: 'Projects' }] : [{ label: 'Build' }, { label: 'Projects' }]} crumbStyle={empty ? 'slash' : 'chevron'}
        title="Projects" subtitle={empty ? 'Your organization is ready. Create your first smart contract project.' : 'Create and manage your smart contract projects, repositories and pipelines.'}
        actions={canCreate && !empty ? <Link className="co-btn co-btn--primary co-btn--wide" to="/projects/new">+ New project</Link> : undefined} />
      {state.status === 'loading' && <LoadingCard label="projects" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Projects" onRetry={reload} />}
      {empty && (
        <div className="co-card co-empty-hero">
          <h2 className="co-card__heading">Your first project starts here</h2>
          <p className="co-subtitle">Connect a repository, configure your build checks and invite teammates when you create a project.</p>
          {canCreate
            ? <Link className="co-btn co-btn--primary co-empty-hero__cta" to="/projects/new">Create First Project <span aria-hidden="true">→</span></Link>
            : <p className="co-help">Ask an organization Owner or Developer to create the first project.</p>}
        </div>
      )}
      {state.status === 'ready' && projects.length > 0 && (
        <>
          <div className="co-filters" role="group" aria-label="Filter projects">
            <input type="search" className="co-control co-filters__search" placeholder="Search projects…" aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} />
            {(['all', 'active', 'paused', 'archived'] as const).filter((key) => key === 'all' || key === 'active' || counts[key] > 0).map((key) => (
              <button key={key} type="button" className={`co-tab co-filters__tab${filter === key ? ' is-active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {key[0].toUpperCase() + key.slice(1)} <span>{counts[key]}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 && <StateMessage title="No projects match" body="Try a different search or status." action={<button type="button" className="co-btn co-btn--outline" onClick={() => { setQuery(''); setFilter('all') }}>Clear filters</button>} />}
          <div className="co-project-list">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
        </>
      )}
    </section>
  )
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const target = project.setupComplete ? `/projects/${project.slug}/dashboard` : project.repository ? `/projects/${project.slug}/setup/pipeline` : `/projects/${project.slug}/setup/repository`
  const run = project.lastRun
  const runText = !run ? 'No runs yet' : run.status === 'success' ? `✓ #${run.runNumber} Build passed` : run.status === 'failed' ? `✕ #${run.runNumber} Build failed` : `#${run.runNumber} ${run.status}`
  return (
    <Link className="co-project-card" to={target} aria-label={`Open ${project.name}`}>
      <div className="co-project-card__identity">
        <img src={projectCube} width={48} height={48} alt="" />
        <div className="co-project-card__labels"><strong>{project.name}</strong><span>{project.description ?? 'No description'}</span></div>
        {project.setupComplete
          ? <span className={`co-pill${project.status === 'active' ? '' : ' co-pill--muted'}`}>{project.status[0].toUpperCase() + project.status.slice(1)}</span>
          : <span className="co-pill co-pill--warning">Setup in progress</span>}
      </div>
      <dl className="co-project-card__meta">
        <div><dt><img src={metaRepository} width={14} height={14} alt="" />Repository</dt><dd>{project.repository ?? 'Not connected'}</dd></div>
        <div><dt><img src={metaFramework} width={14} height={14} alt="" />Framework</dt><dd>{FRAMEWORK_LABELS[project.framework] ?? project.framework}</dd></div>
        <div><dt><img src={metaNetwork} width={14} height={14} alt="" />Network</dt><dd>{project.network ?? 'Not configured'}</dd></div>
        <div><dt><img src={metaPipeline} width={14} height={14} alt="" />Last pipeline</dt><dd className={run?.status === 'failed' ? 'co-text-danger' : undefined}>{runText}</dd></div>
      </dl>
    </Link>
  )
}

// ---------- Frame 09: People / Roles ----------

export function PeoplePage() {
  const gate = useOrganizationGate()
  return gate.element ?? <PeopleView organization={gate.organization!} />
}

function PeopleView({ organization }: { organization: Organization }) {
  const { state, reload, refresh } = useLoad(() => platformApi.members(organization.id), [organization.id])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string; link?: string | null } | null>(null)
  const [busyMember, setBusyMember] = useState<string | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const counts = Object.fromEntries(ROLES.map((r) => [r, data?.members.filter((m) => m.role === r).length ?? 0])) as Record<Role, number>

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFeedback({ kind: 'error', text: 'Enter a valid email address.' }); return }
    if (!role) { setFeedback({ kind: 'error', text: 'Choose a role before sending the invitation.' }); return }
    setSending(true)
    try {
      const sent: SentInvitation = await platformApi.inviteToOrganization(organization.id, email.trim(), role)
      setFeedback({ kind: 'success', text: sent.delivery === 'email' ? `Invitation emailed to ${sent.invitation.email}.` : `Invitation created for ${sent.invitation.email}. Email delivery is not configured — share this link:`, link: sent.delivery === 'email' ? null : sent.inviteLink })
      setEmail(''); setRole('')
      refresh()
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) })
    } finally {
      setSending(false)
    }
  }
  const changeRole = async (member: Member, next: Role) => {
    setBusyMember(member.userId)
    try { await platformApi.changeMemberRole(organization.id, member.userId, next); refresh() }
    catch (error) { setFeedback({ kind: 'error', text: errorMessage(error) }) }
    finally { setBusyMember(null) }
  }
  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.fullName} from ${organization.name}? They lose access to all of its projects.`)) return
    setBusyMember(member.userId)
    try { await platformApi.removeMember(organization.id, member.userId); refresh() }
    catch (error) { setFeedback({ kind: 'error', text: errorMessage(error) }) }
    finally { setBusyMember(null) }
  }
  const revoke = async (invitation: Invitation) => {
    try { await platformApi.revokeOrganizationInvitation(organization.id, invitation.id); refresh() }
    catch (error) { setFeedback({ kind: 'error', text: errorMessage(error) }) }
  }

  return (
    <section className="co-page" aria-labelledby="people-title">
      <PageHeader titleId="people-title" crumbs={[{ label: 'Organization' }, { label: 'People' }, { label: 'Roles' }]} crumbStyle="link" title="Roles" subtitle="Manage organization members and their access permissions." />
      <div className="co-tabs"><span className="co-tab is-active">People &amp; Roles</span></div>
      {state.status === 'loading' && <LoadingCard label="members" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Members" onRetry={reload} />}
      {data && (
        <>
          <div className="co-grid co-grid--4" id="role-permissions">
            {ROLES.map((r) => (
              <div key={r} className="co-card co-role-card">
                <h2 className="co-card__title">{ROLE_LABELS[r]}</h2>
                <p className="co-help">{ROLE_DESCRIPTIONS[r]}</p>
                <span className="co-text-link">{counts[r]} member{counts[r] === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
          {data.canManage ? (
            <form className="co-card co-invite" onSubmit={invite} noValidate>
              <h2 className="co-card__title">Invite a teammate · role required</h2>
              <div className="co-invite__row">
                <div><label className="co-label" htmlFor="invite-email">Email address</label>
                  <input id="invite-email" type="email" className="co-control" placeholder="alex@team.example" value={email} disabled={sending} onChange={(event) => setEmail(event.target.value)} /></div>
                <div><label className="co-label" htmlFor="invite-role">Organization role *</label>
                  <select id="invite-role" className="co-control" value={role} disabled={sending} onChange={(event) => setRole(event.target.value as Role)}>
                    <option value="" disabled>Select role</option>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select></div>
                <button type="submit" className="co-btn co-btn--primary co-invite__submit" disabled={sending || !email.trim() || !role}>{sending ? 'Sending…' : 'Send invite'}</button>
              </div>
              <a className="co-link" href="#role-permissions">Role permissions <span aria-hidden="true">→</span></a>
            </form>
          ) : (
            <p className="co-notice">You are a {ROLE_LABELS[data.role]}. Only organization Owners can invite people or change roles.</p>
          )}
          {feedback && (
            <div className={feedback.kind === 'error' ? 'co-error-box' : 'co-notice co-notice--success'} role={feedback.kind === 'error' ? 'alert' : 'status'}>
              {feedback.text}{feedback.link && <><br /><code className="co-invite-link">{feedback.link}</code></>}
            </div>
          )}
          <h2 className="co-card__title">Organization members ({data.members.length})</h2>
          <div className="co-table-wrap">
            <table className="co-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Projects</th><th scope="col">Joined</th><th scope="col">Status / manage</th></tr></thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.userId}>
                    <td>{member.fullName}{member.isYou && <span className="co-help"> (you)</span>}</td>
                    <td>{member.email}</td>
                    <td>{data.canManage && !member.isYou
                      ? <select className="co-control co-select-inline" aria-label={`Role for ${member.fullName}`} value={member.role} disabled={busyMember === member.userId} onChange={(event) => void changeRole(member, event.target.value as Role)}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      : <span className="co-text-link">{ROLE_LABELS[member.role]}</span>}</td>
                    <td>{member.projectCount === 0 ? 'None' : `${member.projectCount} project${member.projectCount === 1 ? '' : 's'}`}</td>
                    <td>{formatDate(member.joinedAt)}</td>
                    <td><span className="co-text-link">● Active</span>{data.canManage && !member.isYou && <> · <button type="button" className="co-text-button" disabled={busyMember === member.userId} onClick={() => void remove(member)}>Remove</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.invitations.length > 0 && (
            <>
              <h2 className="co-card__title">Pending invitations ({data.invitations.length})</h2>
              <div className="co-table-wrap"><table className="co-table">
                <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Expires</th><th scope="col">Status / manage</th></tr></thead>
                <tbody>{data.invitations.map((invitation) => (
                  <tr key={invitation.id}><td>{invitation.email}</td><td className="co-text-link">{ROLE_LABELS[invitation.role]}</td><td>{formatDate(invitation.expiresAt)}</td>
                    <td><span className="co-text-warning">{invitation.status === 'expired' ? 'Expired' : 'Pending invitation'}</span> · <button type="button" className="co-text-button" onClick={() => void revoke(invitation)}>Revoke</button></td></tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </>
      )}
    </section>
  )
}

// ---------- Frame 10: Organization Settings ----------

export function OrganizationSettingsPage() {
  const gate = useOrganizationGate()
  return gate.element ?? <OrganizationSettingsView organization={gate.organization!} />
}

function OrganizationSettingsView({ organization }: { organization: Organization }) {
  const navigate = useNavigate()
  const { refreshOrganizations } = useShell()
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [teamSize, setTeamSize] = useState(organization.teamSize ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const canManage = organization.role === 'owner'
  const dirty = name.trim() !== organization.name || slug !== organization.slug || teamSize !== (organization.teamSize ?? '')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!dirty || saving) return
    if (!name.trim()) { setMessage({ kind: 'error', text: 'Organization name is required.' }); return }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { setMessage({ kind: 'error', text: 'Slug must use lowercase letters, numbers and single hyphens.' }); return }
    setSaving(true)
    try {
      await platformApi.updateOrganization(organization.id, { name: name.trim(), slug, teamSize: teamSize || null })
      await refreshOrganizations()
      setMessage({ kind: 'success', text: 'Organization settings saved.' })
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }
  const signOut = async () => {
    try { await logout(); navigate('/login', { replace: true, state: { loggedOut: true } }) }
    catch { setMessage({ kind: 'error', text: 'Unable to sign out. Please try again.' }) }
  }

  return (
    <section className="co-page" aria-labelledby="org-settings-title">
      <PageHeader titleId="org-settings-title" crumbs={[{ label: 'Organization' }, { label: 'Organization Settings' }]} crumbStyle="slash" title="Organization Settings" subtitle="Manage the organization name, URL and team preferences." />
      <form className="co-card" onSubmit={save} noValidate>
        <fieldset className="co-fieldset" disabled={!canManage || saving}>
          <legend className="co-visually-hidden">Organization details</legend>
          <label className="co-label co-label--first" htmlFor="settings-name">Organization name</label>
          <input id="settings-name" className="co-control co-control--half" value={name} maxLength={120} onChange={(event) => { setName(event.target.value); setMessage(null) }} />
          <label className="co-label" htmlFor="settings-slug">Organization slug</label>
          <input id="settings-slug" className="co-control co-control--half" value={slug} maxLength={80} onChange={(event) => { setSlug(event.target.value.toLowerCase()); setMessage(null) }} />
          <label className="co-label" htmlFor="settings-size">Team size</label>
          <select id="settings-size" className="co-control co-control--half" value={teamSize} onChange={(event) => { setTeamSize(event.target.value); setMessage(null) }}>
            <option value="">Not set</option>
            {TEAM_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
          </select>
        </fieldset>
        {canManage
          ? <div className="co-actions co-actions--start"><button type="submit" className="co-btn co-btn--primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
          : <p className="co-help">Only organization Owners can change these settings.</p>}
        {message && <p className={message.kind === 'error' ? 'co-error-box' : 'co-notice co-notice--success'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      </form>
      <button type="button" className="co-btn co-btn--danger co-self-start" onClick={() => void signOut()}>Log out</button>
    </section>
  )
}

// ---------- Frame 04: Organization Integrations ----------

export function IntegrationsPage() {
  const gate = useOrganizationGate()
  return gate.element ?? <IntegrationsView organization={gate.organization!} />
}

function IntegrationsView({ organization }: { organization: Organization }) {
  const { state, reload, replace } = useLoad(() => platformApi.integrations(organization.id), [organization.id])
  const [editing, setEditing] = useState(false)
  const [account, setAccount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data = state.status === 'ready' ? state.data : null
  const github = data?.github

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(account.trim())) { setError('Enter a GitHub user or organization name.'); return }
    setBusy(true); setError(null)
    try { replace(await platformApi.connectGitHub(organization.id, account.trim())); setEditing(false) }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  const disconnect = async () => {
    if (!window.confirm('Disconnect GitHub? Existing project repositories keep working; new projects cannot browse this account until it is reconnected.')) return
    setBusy(true)
    try { replace(await platformApi.disconnectGitHub(organization.id)) }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }

  return (
    <section className="co-page" aria-labelledby="integrations-title">
      <PageHeader titleId="integrations-title" crumbs={[{ label: 'Organization' }, { label: 'Integrations' }]} crumbStyle="slash" title="Integrations" subtitle="Manage connections available to projects in this organization." />
      {state.status === 'loading' && <LoadingCard label="integrations" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Integrations" onRetry={reload} />}
      {data && github && (
        <div className="co-card co-integration">
          <h2 className="co-card__heading">GitHub</h2>
          {github.status === 'connected'
            ? <p className="co-integration__status co-text-link">Connected · {github.account}</p>
            : <p className="co-integration__status co-text-warning">Not connected</p>}
          <p className="co-subtitle">Authorize repositories here. Link each repository when creating a project.</p>
          {github.status === 'connected' && (
            <p className="co-help">{github.accountType} account · public repositories · connected {formatDate(github.connectedAt)}{github.connectedBy ? ` by ${github.connectedBy}` : ''}.
              {!data.githubApp.configured && ' Private repositories and webhooks need the ChainOps GitHub App, which is not configured on this server.'}</p>
          )}
          {editing || github.status !== 'connected' ? (
            data.canManage ? (
              <form className="co-inline-form" onSubmit={connect} noValidate>
                <label className="co-label" htmlFor="gh-account">GitHub user or organization</label>
                <div className="co-inline-form__row">
                  <input id="gh-account" className="co-control" value={account} placeholder="e.g. NomicFoundation" disabled={busy} onChange={(event) => { setAccount(event.target.value); setError(null) }} />
                  <button type="submit" className="co-btn co-btn--primary" disabled={busy || !account.trim()}>{busy ? 'Checking…' : 'Connect'}</button>
                  {editing && <button type="button" className="co-btn co-btn--outline" onClick={() => setEditing(false)}>Cancel</button>}
                </div>
              </form>
            ) : <p className="co-help">Ask an organization Owner to connect GitHub.</p>
          ) : data.canManage && (
            <div className="co-actions co-actions--start">
              <button type="button" className="co-btn co-btn--outline co-btn--wide" onClick={() => { setAccount(github.account); setEditing(true) }}>Manage GitHub connection</button>
              <button type="button" className="co-btn co-btn--danger" onClick={() => void disconnect()} disabled={busy}>Disconnect</button>
            </div>
          )}
          {error && <p className="co-error-box" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}

// ---------- Invitations (accept) ----------

export function InvitationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshOrganizations, selectOrganization } = useShell()
  const token = new URLSearchParams(location.hash.slice(1)).get('token')
  const { state, reload } = useLoad(async () => {
    const mine = await platformApi.myInvitations()
    if (!token) return { mine, linked: null as MyInvitation | null, linkError: null as string | null }
    try { return { mine, linked: await platformApi.invitationByToken(token), linkError: null } }
    catch (error) { return { mine, linked: null, linkError: errorMessage(error) } }
  }, [token])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the token out of browser history once it has been read.
  useEffect(() => { if (token) window.history.replaceState(null, '', location.pathname) }, [token, location.pathname])

  const accept = async (invitation: MyInvitation) => {
    setBusy(invitation.id); setError(null)
    try {
      const result = await platformApi.acceptInvitation(invitation.id)
      await refreshOrganizations()
      selectOrganization(result.organizationId)
      navigate(result.projectId ? `/projects/${result.projectId}/dashboard` : '/projects')
    } catch (failure) {
      setError(errorMessage(failure)); setBusy(null)
    }
  }
  const data = state.status === 'ready' ? state.data : null
  return (
    <section className="co-page" aria-labelledby="invitations-title">
      <PageHeader titleId="invitations-title" crumbs={[{ label: 'Account' }, { label: 'Invitations' }]} crumbStyle="slash" title="Invitations" subtitle="Accept invitations to organizations and projects. Access starts only when you accept." />
      {state.status === 'loading' && <LoadingCard label="invitations" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Invitations" onRetry={reload} />}
      {data?.linkError && <p className="co-error-box" role="alert">{data.linkError}</p>}
      {error && <p className="co-error-box" role="alert">{error}</p>}
      {data && data.mine.length === 0 && !data.linkError && <StateMessage title="No pending invitations" body="Invitations sent to your email address appear here." action={<Link className="co-btn co-btn--outline" to="/projects">Go to projects</Link>} />}
      {data?.mine.map((invitation) => (
        <div key={invitation.id} className={`co-card co-invitation${data.linked?.id === invitation.id ? ' is-linked' : ''}`}>
          <h2 className="co-card__title">{invitation.projectName ? `${invitation.projectName} · ${invitation.organizationName}` : invitation.organizationName}</h2>
          <p className="co-help">Role <span className="co-text-link">{ROLE_LABELS[invitation.role]}</span>{invitation.invitedBy && ` · invited by ${invitation.invitedBy}`} · expires {formatDate(invitation.expiresAt)}</p>
          <div className="co-actions co-actions--start"><button type="button" className="co-btn co-btn--primary" disabled={busy !== null} onClick={() => void accept(invitation)}>{busy === invitation.id ? 'Accepting…' : 'Accept invitation'}</button></div>
        </div>
      ))}
    </section>
  )
}
