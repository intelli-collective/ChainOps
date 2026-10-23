from pathlib import Path

content = r'''import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'

import { Member2Navigation, Member2Toolbar } from '../../features/deployments/components/Member2Chrome'
import { platformApi } from '../api/platform'
import { GlobalSearch, NotificationsPopover, ProfileMenu } from '../shell/HeaderControls'
import { ShellProvider } from '../shell/ShellContext'
import { useShell } from '../shell/shellState'

import brandMark from '../shell/icons/brand-mark.svg'
import chainLink from '../shell/icons/chain-link.svg'
import orgIntegrations from '../shell/icons/org-integrations.svg'
import orgPeople from '../shell/icons/org-people.svg'
import orgProjects from '../shell/icons/org-projects.svg'
import orgSettings from '../shell/icons/org-settings.svg'
import navAlerts from '../shell/icons/nav-alerts.svg'
import navApprovals from '../shell/icons/nav-approvals.svg'
import navAssistant from '../shell/icons/nav-assistant.svg'
import navAudit from '../shell/icons/nav-audit.svg'
import navBuild from '../shell/icons/nav-build.svg'
import navContracts from '../shell/icons/nav-contracts.svg'
import navDashboard from '../shell/icons/nav-dashboard.svg'
import navDeployments from '../shell/icons/nav-deployments.svg'
import navEnvironments from '../shell/icons/nav-environments.svg'
import navMonitoring from '../shell/icons/nav-monitoring.svg'
import navNotifications from '../shell/icons/nav-notifications.svg'
import navRegistry from '../shell/icons/nav-registry.svg'
import navRelease from '../shell/icons/nav-release.svg'
import navSecurity from '../shell/icons/nav-security.svg'
import navSettings from '../shell/icons/nav-settings.svg'
import navTeam from '../shell/icons/nav-team.svg'
import navVariables from '../shell/icons/nav-variables.svg'

import './application-layout.css'
import '../ui.css'

interface NavItem {
  label: string
  to: string
  icon: string
  end?: boolean
}

const ORGANIZATION_NAV: NavItem[] = [
  { label: 'Projects', to: '/projects', icon: orgProjects },
  { label: 'People / Roles', to: '/organization/people', icon: orgPeople },
  { label: 'Integrations', to: '/organization/integrations', icon: orgIntegrations },
  { label: 'Settings', to: '/organization/settings', icon: orgSettings },
]

function projectNav(base: string): { group: string | null; items: NavItem[] }[] {
  return [
    {
      group: null,
      items: [{ label: 'Dashboard', to: `${base}/dashboard`, icon: navDashboard }],
    },
    {
      group: 'BUILD',
      items: [
        { label: 'Build (CI) Pipeline', to: `${base}/pipelines`, icon: navBuild },
        { label: 'Security Scans', to: `${base}/security`, icon: navSecurity },
      ],
    },
    {
      group: 'RELEASE',
      items: [
        { label: 'Release (CD) Pipelines', to: `${base}/deployments`, icon: navRelease, end: true },
        { label: 'Approvals', to: `${base}/approvals`, icon: navApprovals },
        { label: 'Deployments', to: `${base}/deployments/new`, icon: navDeployments },
        { label: 'Contract Registry', to: `${base}/contracts`, icon: navRegistry },
        { label: 'Smart Contracts', to: `${base}/smart-contracts`, icon: navContracts },
      ],
    },
    {
      group: 'OPERATE',
      items: [
        { label: 'Monitoring', to: `${base}/monitoring`, icon: navMonitoring },
        { label: 'Alerts', to: `${base}/alerts`, icon: navAlerts },
        { label: 'Audit', to: `${base}/audit`, icon: navAudit },
        { label: 'Notifications', to: `${base}/notifications`, icon: navNotifications },
        { label: 'AI Assistant', to: `${base}/assistant`, icon: navAssistant },
      ],
    },
    {
      group: 'MANAGE',
      items: [
        { label: 'Environments', to: `${base}/environments`, icon: navEnvironments },
        { label: 'Environment Variables', to: `${base}/variables`, icon: navVariables },
        { label: 'Team Info', to: `${base}/team`, icon: navTeam },
        { label: 'Settings', to: `${base}/settings`, icon: navSettings },
      ],
    },
  ]
}

const NETWORK_LABELS: Record<string, string> = {
  'hardhat-local': 'Local Hardhat',
  sepolia: 'Sepolia Testnet',
  holesky: 'Holesky Testnet',
  'ethereum-mainnet': 'Ethereum Mainnet',
  custom: 'Custom network',
}

/** Shared application shell for organization and project workspaces. */
export function ApplicationLayout({ preview = false }: { preview?: boolean }) {
  const { projectId } = useParams()
  const location = useLocation()
  const inProject = Boolean(projectId) && !location.pathname.includes('/setup/')
  const member2 =
    preview ||
    /\/projects\/[^/]+\/(deployments|contracts|artifacts|smart-contracts)(\/|$)/.test(location.pathname)
  const root = preview ? '/preview/member-2' : `/projects/${encodeURIComponent(projectId ?? 'chainvault')}`

  return (
    <ShellProvider projectRef={preview ? null : projectId ?? null}>
      <Shell
        projectRoute={inProject ? projectId! : null}
        preview={preview}
        member2={member2}
        root={root}
      />
    </ShellProvider>
  )
}

function Shell({
  projectRoute,
  preview,
  member2,
  root,
}: {
  projectRoute: string | null
  preview: boolean
  member2: boolean
  root: string
}) {
  const location = useLocation()
  const { organization, project, projectStatus } = useShell()
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [network, setNetwork] = useState<{ project: string; label: string | null } | null>(null)
  const menu = useRef<HTMLButtonElement>(null)

  const drawerOpen = openPath === location.pathname
  const base = projectRoute ? `/projects/${encodeURIComponent(projectRoute)}` : ''

  useEffect(() => {
    if (!project || preview) return

    let active = true
    platformApi.environments(project.id).then(
      (data) => {
        if (!active) return
        const environment = data.environments[0]
        setNetwork({
          project: project.id,
          label: environment
            ? NETWORK_LABELS[environment.network] ?? environment.name
            : null,
        })
      },
      () => undefined,
    )

    return () => {
      active = false
    }
  }, [project, preview])

  const orgName = organization?.name ?? 'ChainOps'
  const projectName = project?.name ?? (projectStatus === 'loading' ? '…' : projectRoute ?? '')
  const networkLabel = project && network?.project === project.id ? network.label : null

  function closeMenu() {
    setOpenPath(null)
    menu.current?.focus()
  }

  function close() {
    setOpenPath(null)
  }

  return (
    <div
      className={`application-shell${location.pathname === '/dashboard' ? ' application-shell--setup' : ''}${member2 ? ' application-shell--member2' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && drawerOpen) closeMenu()
      }}
    >
      <a className="shell-skip" href="#application-content">
        Skip to content
      </a>

      <aside
        id="application-sidebar"
        className={`shell-sidebar${drawerOpen ? ' is-open' : ''}`}
        aria-label={member2 ? 'Deployment navigation' : projectRoute ? 'Project navigation' : 'Organization navigation'}
      >
        {member2 ? (
          <Member2Navigation root={root} close={close} />
        ) : (
          <>
            <Link className="shell-brand" to="/projects" onClick={close}>
              <img src={brandMark} width={28} height={28} alt="" />
              ChainOps
            </Link>
            <p className="shell-context">
              {orgName} / {projectRoute ? projectName : 'Organization'}
            </p>

            {projectRoute ? (
              <>
                <Link className="shell-all-projects" to="/projects" onClick={close}>
                  All Projects
                </Link>
                <nav className="shell-nav shell-nav--project" aria-label="Project">
                  {projectNav(base).map((section) => (
                    <div key={section.group ?? 'top'} className="shell-nav__group">
                      {section.group && <p className="shell-nav__heading">{section.group}</p>}
                      {section.items.map((item) => (
                        <NavLink
                          key={item.label}
                          to={item.to}
                          end={item.end}
                          className="shell-nav__link"
                          onClick={close}
                        >
                          <img src={item.icon} width={16} height={16} alt="" />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </nav>
              </>
            ) : (
              <nav className="shell-nav shell-nav--organization" aria-label="Organization">
                {ORGANIZATION_NAV.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      `shell-nav__link${isActive || (item.to === '/projects' && /^\/projects(\/|$)/.test(location.pathname)) ? ' active' : ''}`
                    }
                    onClick={close}
                  >
                    <img src={item.icon} width={18} height={18} alt="" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </>
        )}
      </aside>

      {drawerOpen && (
        <button className="shell-backdrop" aria-label="Close navigation" onClick={close} />
      )}

      <div className="shell-body">
        <header className="shell-header">
          <button
            ref={menu}
            className="shell-menu"
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            aria-controls="application-sidebar"
            onClick={() => setOpenPath(drawerOpen ? null : location.pathname)}
          >
            ☰
          </button>

          {member2 ? (
            <Member2Toolbar
              root={root}
              projectId={projectRoute ?? 'chainvault'}
              preview={preview}
            />
          ) : projectRoute ? (
            <>
              <Link className="shell-header__context" to={`${base}/dashboard`}>
                <img src={chainLink} width={16} height={16} alt="" />
                {projectName}
              </Link>
              {networkLabel && (
                <span className="shell-header__network">
                  <span aria-hidden="true">●</span> {networkLabel}
                </span>
              )}
            </>
          ) : (
            <Link className="shell-header__context" to="/projects">
              {orgName}
            </Link>
          )}

          {!preview && !member2 && (
            <>
              <GlobalSearch placeholder="Search projects, contracts, runs…" />
              <span className="shell-header__spacer" />
              <NotificationsPopover
                inboxPath={projectRoute ? `${base}/notifications` : '/notifications'}
              />
              <ProfileMenu />
            </>
          )}
        </header>

        <main
          id="application-content"
          className="shell-content"
          tabIndex={-1}
          key={location.pathname}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

out=Path("/mnt/data/application-layout.tsx")
out.write_text(content)
print(out, len(content), content.count("<<<<<<<"), content.count(">>>>>>>"))
