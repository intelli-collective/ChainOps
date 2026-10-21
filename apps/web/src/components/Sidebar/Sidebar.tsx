import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { NavLinkRenderProps } from 'react-router-dom'
import './Sidebar.css'

export type SidebarIconName = 'projects' | 'pipelines' | 'security' | 'approvals' | 'deployments' | 'contracts' | 'monitoring' | 'alerts' | 'audit' | 'settings'

export interface SidebarItem {
  label: string
  to: string
  icon: SidebarIconName
  /** Match only this exact path rather than its child routes. */
  end?: boolean
}

export interface SidebarGroup {
  label: string
  items: readonly SidebarItem[]
}

export interface SidebarProps {
  projectId: string
  workspaceName?: string
  workspaceDescription?: string
  groups?: readonly SidebarGroup[]
  brandHref?: string
  logoSrc?: string
  brandingSrc?: string
  className?: string
  onNavigate?: () => void
}

const iconPaths: Record<SidebarIconName, ReactNode> = {
  projects: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  pipelines: <><rect x="3" y="8" width="5" height="8" rx="1.5" /><rect x="16" y="3" width="5" height="6" rx="1.5" /><rect x="16" y="15" width="5" height="6" rx="1.5" /><path d="M8 12h4m0 0V6h4m-4 6v6h4" /></>,
  security: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  approvals: <><path d="M9 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-3" /><rect x="9" y="2" width="6" height="5" rx="1" /><path d="m8 13 3 3 5-6" /></>,
  deployments: <><path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /><path d="M8 17h8" /></>,
  contracts: <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v5h5m-9 4-2 2 2 2m4-4 2 2-2 2" /></>,
  monitoring: <><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M6 11h3l2-4 3 8 2-4h2m-9 11h6m-3-4v4" /></>,
  alerts: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
  audit: <><path d="M10 3H4v18h16v-7M8 8h3m-3 5h3m-3 4h7" /><circle cx="17" cy="6" r="3" /><path d="m19.2 8.2 2.8 2.8" /></>,
  settings: <><path d="m9 3-.5 3-2 1-2.8-1L1.8 9l2.3 2v2l-2.3 2 1.9 3 2.8-1 2 1 .5 3h6l.5-3 2-1 2.8 1 1.9-3-2.3-2v-2l2.3-2-1.9-3-2.8 1-2-1L15 3H9Z" /><circle cx="12" cy="12" r="3" /></>,
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  return <svg className="chainops-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{iconPaths[name]}</svg>
}

/** Render within the application's BrowserRouter. Parent layout owns positioning. */
export function Sidebar({
  projectId,
  workspaceName = 'ChainOps Team',
  workspaceDescription = 'Workspace',
  groups,
  brandHref = '/projects',
  logoSrc = `${import.meta.env.BASE_URL}logo.jpg`,
  brandingSrc = `${import.meta.env.BASE_URL}branding.jpg`,
  className = '',
  onNavigate,
}: SidebarProps) {
  const projectPath = `/projects/${encodeURIComponent(projectId)}`
  const navigation: readonly SidebarGroup[] = groups ?? [
    { label: 'Build', items: [
      { label: 'Projects', to: '/projects', icon: 'projects', end: true },
      { label: 'Pipelines', to: `${projectPath}/pipelines`, icon: 'pipelines' },
      { label: 'Security', to: `${projectPath}/security`, icon: 'security' },
    ] },
    { label: 'Release', items: [
      { label: 'Approvals', to: `${projectPath}/approvals`, icon: 'approvals' },
      { label: 'Deployments', to: `${projectPath}/deployments`, icon: 'deployments' },
      { label: 'Contracts', to: `${projectPath}/contracts`, icon: 'contracts' },
    ] },
    { label: 'Operate', items: [
      { label: 'Monitoring', to: `${projectPath}/monitoring`, icon: 'monitoring' },
      { label: 'Alerts', to: `${projectPath}/alerts`, icon: 'alerts' },
      { label: 'Audit', to: `${projectPath}/audit`, icon: 'audit' },
      { label: 'Settings', to: `${projectPath}/settings`, icon: 'settings' },
    ] },
  ]

  return <aside className={`chainops-sidebar ${className}`} aria-label="Workspace sidebar">
    <NavLink className="chainops-sidebar__brand" to={brandHref} aria-label="ChainOps home" onClick={onNavigate}>
      <img className="chainops-sidebar__logo" src={logoSrc} alt="" width="44" height="44" />
      <span className="chainops-sidebar__wordmark" aria-hidden="true">
        <img src={brandingSrc} alt="" width="240" height="80" />
      </span>
    </NavLink>
    <div className="chainops-sidebar__workspace">
      <span>{workspaceName}</span>
      <span>{workspaceDescription}</span>
    </div>
    <nav className="chainops-sidebar__navigation" aria-label="Main navigation">
      {navigation.map(group => <section className="chainops-sidebar__group" key={group.label} aria-label={group.label}>
        <h2 className="chainops-sidebar__heading">{group.label}</h2>
        <ul className="chainops-sidebar__list">
          {group.items.map(item => <li key={item.to}>
            <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }: NavLinkRenderProps) => `chainops-sidebar__link${isActive ? ' chainops-sidebar__link--active' : ''}`}>
              <SidebarIcon name={item.icon} /><span>{item.label}</span>
            </NavLink>
          </li>)}
        </ul>
      </section>)}
    </nav>
  </aside>
}
