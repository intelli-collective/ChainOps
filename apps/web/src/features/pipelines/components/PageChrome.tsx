import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../hooks/usePipelineData'
import type { ProjectSummary } from '../types/pipelineRun'

interface Crumb { label: string; to?: string }

/** Back button, breadcrumb, title, subtitle and actions, as in the M1 frames. */
export function PageHeader({ back, crumbs, title, subtitle, subtitleTone, actions }: {
  back?: string
  crumbs: Crumb[]
  title: string
  subtitle?: ReactNode
  subtitleTone?: 'success' | 'danger' | 'warning'
  actions?: ReactNode
}) {
  return (
    <>
      <div className="pr-topline">
        {back && <Link className="pr-back-button" to={back}><span aria-hidden="true">←</span> Back</Link>}
        <nav aria-label="Breadcrumb" className="pr-breadcrumb">
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={crumb.label} aria-current={index === crumbs.length - 1 ? 'page' : undefined}>
                {crumb.to && index < crumbs.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <header className="pr-header">
        <h1 className="pr-title">{title}</h1>
        {actions && <div className="pr-header__actions">{actions}</div>}
      </header>
      {subtitle && <p className={`pr-subtitle${subtitleTone ? ` pr-subtitle--${subtitleTone}` : ''}`}>{subtitle}</p>}
    </>
  )
}

export function StateMessage({ title, body, role, action }: { title: string; body: ReactNode; role?: 'alert' | 'status'; action?: ReactNode }) {
  return (
    <div className="pr-state" role={role}>
      <p className="pr-state__title">{title}</p>
      <div className="pr-state__body">{body}</div>
      {action}
    </div>
  )
}

/** Resolves the route project and renders loading / not found / no access / error states. */
export function ProjectGate({ projectRef, label, children }: { projectRef: string; label: string; children: (project: ProjectSummary) => ReactNode }) {
  const { state, reload } = useProject(projectRef)
  if (state.status === 'loading') return <section className="pr-page" aria-busy="true"><p className="pr-subtitle" role="status">Loading {label}…</p></section>
  if (state.status === 'error') {
    const missing = state.code === 404
    return (
      <section className="pr-page">
        <StateMessage
          role="alert"
          title={missing ? 'Project not found' : state.code === 403 ? 'No access to this project' : `Couldn’t load ${label}`}
          body={missing ? 'This project does not exist or is not in one of your organizations.' : state.message}
          action={missing ? <Link className="pr-secondary-button" to="/projects">All projects</Link> : <button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>}
        />
      </section>
    )
  }
  return <>{children(state.data)}</>
}

const STEPS = [
  { title: 'Project details', body: 'Name, description and framework' },
  { title: 'Connect repository', body: 'Link your source code' },
  { title: 'Configure pipeline', body: 'Set up build and security checks' },
  { title: 'Invite team', body: 'Invite members and assign roles' },
  { title: 'Review & create', body: 'Confirm project and team access' },
]

/** Project setup progress. Steps 1, 4 and 5 belong to the platform (M5) setup flow. */
export function SetupSteps({ current, completed }: { current: 1 | 2; completed: number[] }) {
  return (
    <ol className="pr-setup-steps" aria-label="Project setup progress">
      {STEPS.map((step, index) => {
        const done = completed.includes(index)
        const active = index === current
        return (
          <li key={step.title} className={active ? 'is-active' : done ? 'is-done' : undefined} aria-current={active ? 'step' : undefined}>
            <strong>{done ? <span aria-hidden="true">✓</span> : <span>{index + 1}</span>} {step.title}{done && <span className="pr-visually-hidden"> (completed)</span>}</strong>
            <span>{step.body}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Numbered, plain-text log output. Content is rendered as text, never as HTML. */
export function LogViewer({ lines, label, live, empty }: { lines: string[]; label: string; live?: boolean; empty: string }) {
  if (lines.length === 0) return <p className="pr-log-empty">{empty}</p>
  const width = String(lines.length).length < 2 ? 2 : String(lines.length).length
  return (
    <div className="pr-log" role="log" aria-label={label} aria-live={live ? 'polite' : 'off'} tabIndex={0}>
      {lines.map((line, index) => (
        <div key={index} className="pr-log__line">
          <span className="pr-log__number" aria-hidden="true">{String(index + 1).padStart(width, '0')}</span>
          <span className="pr-log__text">{line || ' '}</span>
        </div>
      ))}
    </div>
  )
}
