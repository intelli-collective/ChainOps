import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../../features/auth/api'
import { errorMessage } from '../api/client'
import { platformApi, ROLE_LABELS, type Notification, type SearchResult } from '../api/platform'
import bellIcon from './icons/bell.svg'
import bellUnreadIcon from './icons/bell-unread.svg'
import chevronDown from './icons/chevron-down.svg'
import { useShell } from './shellState'

/** Anchored popover state: closes on outside click and Escape, and returns focus to the trigger. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback((restoreFocus = true) => { setOpen(false); if (restoreFocus) trigger.current?.focus() }, [])
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(false) }
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return { open, setOpen, close, root, trigger }
}

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationsPopover({ inboxPath }: { inboxPath: string }) {
  const navigate = useNavigate()
  const { open, setOpen, close, root, trigger } = usePopover()
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: Notification[]; unread: number; message?: string }>({ status: 'loading', items: [], unread: 0 })
  const panelId = useId()

  const load = useCallback(async () => {
    try {
      const data = await platformApi.notifications(6)
      setState({ status: 'ready', items: data.items, unread: data.unreadCount })
    } catch (error) {
      setState((current) => ({ ...current, status: 'error', message: errorMessage(error) }))
    }
  }, [])

  // Unread state stays current while the app is open.
  useEffect(() => {
    let active = true
    const tick = () => { if (active && document.visibilityState === 'visible') void load() }
    tick()
    const interval = window.setInterval(tick, 60000)
    return () => { active = false; window.clearInterval(interval) }
  }, [load])

  const openItem = async (item: Notification) => {
    if (!item.read) await platformApi.markNotificationRead(item.id).catch(() => undefined)
    close(false)
    void load()
    if (item.link) navigate(item.link)
  }
  const markAll = async () => {
    await platformApi.markAllNotificationsRead().catch(() => undefined)
    void load()
  }

  return (
    <div className="co-popover-root" ref={root}>
      <button ref={trigger} type="button" className="co-icon-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId}
        aria-label={state.unread ? `Notifications, ${state.unread} unread` : 'Notifications'}
        onClick={() => { if (!open) void load(); setOpen(!open) }}>
        <img src={state.unread ? bellUnreadIcon : bellIcon} width={state.unread ? 32 : 20} height={state.unread ? 32 : 20} alt="" />
      </button>
      {open && (
        <div id={panelId} className="co-popover co-popover--notifications" role="dialog" aria-label="Notifications">
          <div className="co-popover__header">
            <strong>Notifications</strong>
            {state.unread > 0 && <button type="button" className="co-text-button" onClick={markAll}>Mark all read</button>}
          </div>
          {state.status === 'loading' && <p className="co-popover__state" role="status">Loading…</p>}
          {state.status === 'error' && <p className="co-popover__state" role="alert">{state.message} <button type="button" className="co-text-button" onClick={() => void load()}>Retry</button></p>}
          {state.status === 'ready' && state.items.length === 0 && <p className="co-popover__state">You’re all caught up. Pipeline results, invitations and team changes appear here.</p>}
          {state.items.length > 0 && (
            <ul className="co-notification-list">
              {state.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`co-notification${item.read ? '' : ' is-unread'}`} onClick={() => void openItem(item)}>
                    <span className="co-notification__dot" aria-hidden="true" />
                    <span className="co-notification__body">
                      <strong>{item.title}{!item.read && <span className="co-visually-hidden"> (unread)</span>}</strong>
                      <span>{item.body}</span>
                      <small>{[item.context, timeAgo(item.createdAt)].filter(Boolean).join(' · ')}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className="co-popover__footer" to={inboxPath} onClick={() => close(false)}>View all notifications <span aria-hidden="true">→</span></Link>
        </div>
      )}
    </div>
  )
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'

export function ProfileMenu() {
  const navigate = useNavigate()
  const { profile, organization } = useShell()
  const { open, setOpen, close, root, trigger } = usePopover()
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const menuId = useId()
  const name = profile?.user.fullName ?? 'Account'

  const signOut = async () => {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true, state: { loggedOut: true } })
    } catch {
      setError('Unable to sign out. Please try again.')
      setSigningOut(false)
    }
  }
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const index = items.indexOf(document.activeElement as HTMLElement)
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div className="co-popover-root" ref={root}>
      <button ref={trigger} type="button" className="co-profile" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
        <span className="co-avatar" aria-hidden="true">{initials(name)}</span>
        <span className="co-profile__name">{name}</span>
        <img src={chevronDown} width={12} height={12} alt="" />
      </button>
      {open && (
        <div id={menuId} className="co-popover co-popover--profile" role="menu" aria-label="Account" onKeyDown={onMenuKey}>
          <div className="co-profile-summary" role="none">
            <span className="co-avatar co-avatar--large" aria-hidden="true">{initials(name)}</span>
            <span><strong>{name}</strong><span>{profile?.user.email}</span>
              {organization && <small>{organization.name} · {ROLE_LABELS[organization.role]}</small>}</span>
          </div>
          <Link role="menuitem" className="co-menu-item" to="/projects" onClick={() => close(false)}>All projects</Link>
          {organization && <Link role="menuitem" className="co-menu-item" to="/organization/settings" onClick={() => close(false)}>Organization settings</Link>}
          <Link role="menuitem" className="co-menu-item" to="/invitations" onClick={() => close(false)}>Invitations</Link>
          <button role="menuitem" type="button" className="co-menu-item co-menu-item--danger" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          {error && <p className="co-popover__state" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}

const TYPE_LABELS: Record<SearchResult['type'], string> = { project: 'Project', run: 'Pipeline run', contract: 'Contract' }

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const navigate = useNavigate()
  const { open, setOpen, close, root } = usePopover()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; results: SearchResult[]; message?: string }>({ status: 'idle', results: [] })
  const [active, setActive] = useState(-1)
  const listId = useId()

  // Debounced, network-backed search; results only include the user's organizations.
  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) return
    let current = true
    const timer = window.setTimeout(() => {
      setState((previous) => ({ ...previous, status: 'loading' }))
      platformApi.search(value).then(
        (data) => { if (current) { setState({ status: 'ready', results: data.results }); setActive(-1) } },
        (error: unknown) => { if (current) setState({ status: 'error', results: [], message: errorMessage(error) }) },
      )
    }, 250)
    return () => { current = false; window.clearTimeout(timer) }
  }, [query])

  const go = (result: SearchResult) => { close(false); setQuery(''); navigate(result.link) }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, state.results.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && state.results[active]) { event.preventDefault(); go(state.results[active]) }
  }
  const renderContent = (): ReactNode => {
  if (query.trim().length < 2) return <p className="co-popover__state">Type at least 2 characters to search projects, runs (#12 or a commit) and contracts.</p>
  if (state.status === 'loading' || state.status === 'idle') return <p className="co-popover__state" role="status">Searching…</p>
  if (state.status === 'error') return <p className="co-popover__state" role="alert">{state.message}</p>
  if (state.results.length === 0) return <p className="co-popover__state">No projects, runs or contracts match “{query.trim()}”.</p>
  return (
    <ul id={listId} role="listbox" className="co-search-results">
      {state.results.map((result, index) => (
        <li key={`${result.type}-${result.link}`} id={`${listId}-${index}`} role="option" aria-selected={index === active}
          className={index === active ? 'is-active' : undefined} onPointerDown={(event) => { event.preventDefault(); go(result) }}>
          <span className="co-search-results__type">{TYPE_LABELS[result.type]}</span>
          <strong>{result.title}</strong>
          <small>{result.context}</small>
        </li>
      ))}
    </ul>
  )
  }

  return (
    <div className="co-popover-root co-search" ref={root}>
      <input type="search" className="co-search__input" placeholder={placeholder} aria-label="Search projects, contracts and runs" value={query}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      {open && <div className="co-popover co-popover--search">{renderContent()}</div>}
    </div>
  )
}
