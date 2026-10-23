import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import './application-layout.css'
import { logout } from '../../features/auth/api'
import { useNavigate } from 'react-router-dom'

export function ApplicationLayout() {
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const { projectId = 'chainvault' } = useParams()
  const project = `/projects/${encodeURIComponent(projectId)}`
  const location = useLocation()
  const [openPath, setOpenPath] = useState<string | null>(null)
  const menu = useRef<HTMLButtonElement>(null)
  const open = openPath === location.pathname
  const links = [
    { label: 'Overview', to: '/dashboard' }, { label: 'Projects', to: '/projects', end: true },
    { label: 'Pipelines', to: `${project}/pipelines` }, { label: 'Security', to: `${project}/security` },
    { label: 'Deployments', to: `${project}/deployments` }, { label: 'Contracts', to: `${project}/contracts` },
    { label: 'Monitoring', to: `${project}/monitoring` }, { label: 'Alerts', to: `${project}/monitoring/alerts` },
    { label: 'Audit', to: '/audit' }, { label: 'Settings', to: '/settings' },
  ]
  function closeMenu() { setOpenPath(null); menu.current?.focus() }
  return <div className={`application-shell${location.pathname === '/dashboard' ? ' application-shell--setup' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && open) closeMenu() }}>
    <a className="shell-skip" href="#application-content">Skip to content</a>
    <aside id="application-sidebar" className={`shell-sidebar${open ? ' is-open' : ''}`} aria-label="Workspace navigation">
      <Link className="shell-brand" to="/dashboard" onClick={() => setOpenPath(null)}>
        <svg width="42" height="42" viewBox="0 0 48 48" aria-hidden="true"><path d="M5 16 25 4l12 7-20 12v12L5 28Z" fill="var(--shell-border)"/><path d="m17 23 20-12 9 6v20L26 48l-10-6 20-12V20L17 31Z" fill="var(--shell-button)"/></svg>
        ChainOps
      </Link>
      <p className="shell-workspace">Workspace<br />ChainOps Team</p>
      <nav aria-label="Main navigation">{links.map(link => <NavLink key={link.label} to={link.to} end={link.end} onClick={() => setOpenPath(null)}>{link.label}</NavLink>)}</nav>
      <button className="shell-logout" onClick={async () => { try { await logout(); navigate('/login', { replace: true, state: { loggedOut: true } }) } catch { setLogoutError('Unable to log out. Please try again.') } }}>Log out</button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </aside>
    {open && <button className="shell-backdrop" aria-label="Close navigation" onClick={closeMenu} />}
    <div className="shell-body">
      <header className="shell-header">
        <button ref={menu} className="shell-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="application-sidebar" onClick={() => setOpenPath(open ? null : location.pathname)}>☰</button>
        <span>Escrow protocol</span>
        <div className="shell-account"><span>Sepolia · Testnet</span><span aria-hidden="true">◇</span><span aria-label="User DS">DS</span></div>
      </header>
      <main id="application-content" className="shell-content" tabIndex={-1} key={location.pathname}><Outlet /></main>
    </div>
  </div>
}
