import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface Crumb { label: string; to?: string }

/** Back button, breadcrumb, title, subtitle and actions — the heading pattern used across the Figma frames. */
export function PageHeader({ back, crumbs, crumbStyle = 'chevron', title, subtitle, actions, titleId }: {
  back?: string
  crumbs: Crumb[]
  crumbStyle?: 'chevron' | 'slash' | 'link'
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  titleId?: string
}) {
  const crumbClass = crumbStyle === 'chevron' ? 'co-breadcrumb' : crumbStyle === 'slash' ? 'co-breadcrumb co-breadcrumb--slash' : 'co-breadcrumb co-breadcrumb--slash co-breadcrumb--link'
  return (
    <>
      <div className="co-topline">
        {back && <Link className="co-back" to={back}><span aria-hidden="true">←</span> Back</Link>}
        <nav aria-label="Breadcrumb" className={crumbClass}>
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} aria-current={index === crumbs.length - 1 ? 'page' : undefined}>
                {crumb.to && index < crumbs.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <header className="co-header">
        <h1 className="co-title" id={titleId}>{title}</h1>
        {actions && <div className="co-actions co-actions--start" style={{ marginTop: 0 }}>{actions}</div>}
      </header>
      {subtitle && <p className="co-subtitle">{subtitle}</p>}
    </>
  )
}

export function StateMessage({ title, body, role, action }: { title: string; body: ReactNode; role?: 'alert' | 'status'; action?: ReactNode }) {
  return (
    <div className="co-state" role={role}>
      <p className="co-state__title">{title}</p>
      <div>{body}</div>
      {action}
    </div>
  )
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className="co-card" aria-busy="true">
      <span className="co-visually-hidden" role="status">Loading {label}…</span>
      <span className="co-skeleton co-skeleton--title" />
      <span className="co-skeleton" />
      <span className="co-skeleton" />
    </div>
  )
}

/** Error card for a failed load; 403/404 get specific wording. */
export function LoadError({ code, message, what, onRetry }: { code: number; message: string; what: string; onRetry: () => void }) {
  if (code === 404) return <StateMessage title={`${what} not found`} body="It does not exist or is not in one of your organizations." action={<Link className="co-btn co-btn--outline" to="/projects">All projects</Link>} />
  if (code === 403) return <StateMessage role="alert" title="No access" body={message} />
  return <StateMessage role="alert" title={`Couldn’t load ${what.toLowerCase()}`} body={message} action={<button type="button" className="co-btn co-btn--outline" onClick={onRetry}>Retry</button>} />
}

const STEPS = [
  { title: 'Project details', body: 'Name, description and framework' },
  { title: 'Connect repository', body: 'Link your source code' },
  { title: 'Configure pipeline', body: 'Set up build and security checks' },
  { title: 'Invite team', body: 'Invite members and assign roles' },
  { title: 'Review & create', body: 'Confirm project and team access' },
]

/** Shared 5-step project creation progress (steps 2–3 are the M1 pipeline steps). */
export function ProjectSetupSteps({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <ol className="co-setup-steps" aria-label="Project setup progress">
      {STEPS.map((step, index) => {
        const done = index < current
        return (
          <li key={step.title} className={index === current ? 'is-active' : undefined} aria-current={index === current ? 'step' : undefined}>
            <strong>{done ? <span aria-hidden="true">✓</span> : <span>{index + 1}</span>} {step.title}{done && <span className="co-visually-hidden"> (completed)</span>}</strong>
            <span>{step.body}</span>
          </li>
        )
      })}
    </ol>
  )
}
