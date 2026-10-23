import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { authRequest, logout } from '../../auth/api'
import type { Profile } from '../../auth/api'
import { member2Api } from '../services/member2Api'
import './member2-chrome.css'

const groups = [
  { label: '', links: [['Dashboard', 'Dashboard', '/dashboard']] },
  {
    label: 'BUILD',
    links: [
      ['Build (CI) Pipeline', 'BuildCiPipeline', '/pipelines'],
      ['Security Scans', 'SecurityScans', '/security']
    ]
  },
  {
    label: 'RELEASE',
    links: [
      ['Release (CD) Pipelines', 'ReleaseCdPipelines', ''],
      ['Approvals', 'Approvals', ''],
      ['Deployments', 'Deployments', '/deployments'],
      ['Contract Registry', 'ContractRegistry', '/contracts'],
      ['Smart Contracts', 'SmartContracts', '/smart-contracts']
    ]
  },
  {
    label: 'OPERATE',
    links: [
      ['Monitoring', 'Monitoring', '/monitoring'],
      ['Alerts', 'Alerts', '/alerts'],
      ['Audit', 'Audit', '/audit'],
      ['Notifications', 'Notifications', ''],
      ['AI Assistant', 'AiAssistant', '']
    ]
  },
  {
    label: 'MANAGE',
    links: [
      ['Environments', 'Environments', ''],
      ['Environment Variables', 'EnvironmentVariables', ''],
      ['Team Info', 'TeamInfo', ''],
      ['Settings', 'Settings', '/settings']
    ]
  }
]
export function Member2Navigation({
  root,
  close
}: {
  root: string
  close: () => void
}) {
  const location = useLocation()
  const projectLabel =
    root.includes('chainvault') || root.startsWith('/preview/')
      ? 'ChainVault'
      : 'Project'
  const detail = /\/contracts\/(?!register)/.test(location.pathname)
  return (
    <>
      <Link className="m2-brand" to="/dashboard" onClick={close}>
        <img
          src="/assets/member2/ApprovedChainOpsLogoArtwork.svg"
          alt=""
          width="40"
          height="40"
        />
        <span>ChainOps</span>
      </Link>
      <p className="m2-workspace">ChainOps Team / {projectLabel}</p>
      <Link className="m2-all-projects" to="/projects">
        All Projects
      </Link>
      <nav className="m2-navigation" aria-label="Project navigation">
        {groups.map((g) => (
          <div key={g.label}>
            {g.label && <p className="m2-navigation-group">{g.label}</p>}
            {g.links.map(([label, icon, path]) => {
              const content = (
                <>
                  <img
                    src={`/assets/member2/Icon${icon}.svg`}
                    alt=""
                    width="16"
                    height="16"
                  />
                  <span>{label}</span>
                </>
              )
              if (!path)
                return (
                  <button
                    disabled
                    title={`${label} integration is not available yet`}
                    key={label}
                  >
                    {content}
                  </button>
                )
              const target = [
                '/dashboard',
                '/projects',
                '/alerts',
                '/audit',
                '/settings'
              ].includes(path)
                ? path
                : `${root}${path}`
              return (
                <NavLink
                  key={label}
                  to={target}
                  end={path === '/contracts'}
                  onClick={close}
                  className={({ isActive }: { isActive: boolean }) =>
                    (isActive && !(path === '/contracts' && detail)) ||
                    (path === '/smart-contracts' && detail)
                      ? 'active'
                      : ''
                  }
                >
                  {content}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}

export function Member2Toolbar({
  root,
  projectId,
  preview
}: {
  root: string
  projectId: string
  preview: boolean
}) {
  const [networkName, setNetworkName] = useState(
    preview ? 'Sepolia Testnet' : 'Network unavailable'
  )
  const projectLabel =
    preview || projectId === 'chainvault' ? 'ChainVault' : 'Project'
  const [profile, setProfile] = useState<Profile>(),
    [profileError, setProfileError] = useState(false),
    [menu, setMenu] = useState<'notifications' | 'profile' | null>(null),
    [query, setQuery] = useState('')
  const [results, setResults] = useState<{ label: string; to: string }[]>([]),
    [searchState, setSearchState] = useState<
      'idle' | 'loading' | 'error' | 'ready'
    >('idle'),
    [error, setError] = useState('')
  const container = useRef<HTMLDivElement>(null),
    bell = useRef<HTMLButtonElement>(null),
    account = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let active = true
    if (!preview)
      member2Api
        .networks(projectId)
        .then((networks) => {
          if (active)
            setNetworkName(networks[0]?.name ?? 'No network configured')
        })
        .catch(() => {
          if (active) setNetworkName('Network unavailable')
        })
    return () => {
      active = false
    }
  }, [preview, projectId])
  useEffect(() => {
    let active = true
    if (!preview)
      authRequest<Profile>('me')
        .then((p) => {
          if (active) setProfile(p)
        })
        .catch(() => {
          if (active) setProfileError(true)
        })
    return () => {
      active = false
    }
  }, [preview])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setMenu(null)
        setQuery('')
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        ;(menu === 'profile' ? account : bell).current?.focus()
        setMenu(null)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [menu])
  useEffect(() => {
    if (!query.trim()) return
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const local = [
          { label: 'Deployments', to: `${root}/deployments` },
          { label: 'Contract Registry', to: `${root}/contracts` },
          { label: 'New deployment', to: `${root}/deployments/new` }
        ]
        const data = preview
          ? []
          : await Promise.all([
              member2Api.contracts(projectId),
              member2Api.deployments(projectId)
            ]).then(([contracts, deployments]) => [
              ...contracts.map((c) => ({
                label: `${c.name} ${c.version} · ${c.address}`,
                to: `${root}/contracts/${c.id}`
              })),
              ...deployments.map((d) => ({
                label: `${d.artifact.name} · ${d.transactionHash ?? d.id}`,
                to: `${root}/deployments/${d.id}/transaction`
              }))
            ])
        if (active) {
          setResults(
            [...local, ...data]
              .filter((r) =>
                r.label.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 8)
          )
          setSearchState('ready')
        }
      } catch {
        if (active) setSearchState('error')
      }
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, projectId, root, preview])
  const fullName =
    profile?.user.fullName ?? (preview ? 'Dulmina Sithara' : 'Account')
  return (
    <div className="m2-toolbar-content" ref={container}>
      <Link className="m2-project-label" to="/projects">
        <img
          src="/assets/member2/ChainLinkIcon.svg"
          alt=""
          width="16"
          height="16"
        />
        {projectLabel}
      </Link>
      <span className="m2-toolbar-network">● {networkName}</span>
      <div className="m2-global-search">
        <input
          type="search"
          aria-label="Global search"
          placeholder="Search projects, contracts, transactions…"
          value={query}
          aria-expanded={Boolean(query)}
          aria-controls="m2-search-results"
          onFocus={() => setMenu(null)}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchState('loading')
          }}
        />
        {query && (
          <div
            id="m2-search-results"
            className="m2-toolbar-popover m2-search-results"
          >
            {searchState === 'loading' && <p role="status">Searching…</p>}
            {searchState === 'error' && (
              <p role="alert">Search is unavailable. Try again.</p>
            )}
            {searchState === 'ready' &&
              (results.length ? (
                results.map((r) => (
                  <Link key={r.to} to={r.to} onClick={() => setQuery('')}>
                    {r.label}
                  </Link>
                ))
              ) : (
                <p>No matching resources.</p>
              ))}
          </div>
        )}
      </div>
      <div className="m2-toolbar-right">
        <button
          ref={bell}
          className="m2-bell"
          aria-label="Notifications"
          aria-expanded={menu === 'notifications'}
          aria-controls="m2-notifications"
          onClick={() => {
            setMenu(menu === 'notifications' ? null : 'notifications')
            setQuery('')
          }}
        >
          <img
            src={`/assets/member2/${preview ? 'NotificationsUnread' : 'IconNotifications'}.svg`}
            alt=""
            width={preview ? 32 : 16}
            height={preview ? 32 : 16}
          />
        </button>
        <button
          ref={account}
          className="m2-profile"
          aria-expanded={menu === 'profile'}
          aria-controls="m2-profile-menu"
          onClick={() => {
            setMenu(menu === 'profile' ? null : 'profile')
            setQuery('')
          }}
        >
          <span className="m2-avatar">
            {preview ? (
              <img
                src="/assets/member2/Avatar.png"
                alt=""
                width="28"
                height="28"
              />
            ) : (
              fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
            )}
          </span>
          <span>{fullName}</span>
          <img
            src="/assets/member2/ChevronDown.svg"
            alt=""
            width="12"
            height="12"
          />
        </button>
      </div>
      {menu === 'notifications' && (
        <div
          id="m2-notifications"
          className="m2-toolbar-popover"
          role="region"
          aria-label="Notifications"
        >
          <strong>Notifications</strong>
          <p>Notifications are not connected yet.</p>
          <p>
            Connect the shared notification service to show recent activity.
          </p>
        </div>
      )}
      {menu === 'profile' && (
        <div
          id="m2-profile-menu"
          className="m2-toolbar-popover"
          role="region"
          aria-label="Account"
        >
          <strong>{fullName}</strong>
          {profile && <p>{profile.user.email}</p>}
          {preview ? (
            <p>Development preview session</p>
          ) : profileError ? (
            <p role="alert">Unable to load account details.</p>
          ) : (
            !profile && <p role="status">Loading account…</p>
          )}
          <Link to="/settings" onClick={() => setMenu(null)}>
            Settings
          </Link>
          {!preview && (
            <button
              onClick={async () => {
                try {
                  await logout()
                } catch {
                  setError('Unable to sign out. Try again.')
                }
              }}
            >
              Sign out
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
