import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { authRequest, restoreSession, subscribeToLogout } from './api'
import { AuthHeading, AuthLayout } from './AuthLayout'
import { useEmailToken } from './authUtils'

export function ProtectedRoutes() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized'>('loading')
  const location = useLocation()
  useEffect(() => {
    let active = true
    let revoked = false
    const unsubscribe = subscribeToLogout(() => { revoked = true; setStatus('unauthorized') })
    const check = async () => { const profile = await restoreSession(); if (active && !revoked) setStatus(profile ? 'ready' : 'unauthorized') }
    const restore = () => { if (!revoked) { setStatus('loading'); void check() } }
    const visible = () => { if (document.visibilityState === 'visible') restore() }
    window.addEventListener('pageshow', restore)
    document.addEventListener('visibilitychange', visible)
    void check()
    const interval = window.setInterval(() => { void check() }, 8 * 60 * 1000)
    return () => { active = false; unsubscribe(); window.clearInterval(interval); window.removeEventListener('pageshow', restore); document.removeEventListener('visibilitychange', visible) }
  }, [location.pathname])
  if (status === 'loading') return <p role="status">Restoring your session…</p>
  return status === 'ready' ? <Outlet /> : <Navigate to="/login" replace />
}

export function VerifyEmail() {
  const token = useEmailToken('/verify-email')
  const [message, setMessage] = useState('Confirm your email ownership to continue.')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [failed, setFailed] = useState(false)
  return <AuthLayout variant="auth-page--recovery"><div className="auth-status-icon" aria-hidden="true">{complete ? '✓' : '✉'}</div><AuthHeading title="Verify your email" subtitle="One more step to your connected workspace."/><p className={`auth-notice auth-notice--${failed ? 'error' : 'success'}`} role={failed ? 'alert' : 'status'}>{token ? message : 'Verification link is missing. Return to sign in to request a new email.'}</p><button className="auth-submit" disabled={!token || pending || complete} onClick={async () => {
    setPending(true)
    try { const result = await authRequest<{ message: string }>('verify-email', { token }); setMessage(result.message); setComplete(true); setFailed(false) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to verify email'); setFailed(true) }
    finally { setPending(false) }
  }}>{pending ? 'Verifying…' : complete ? 'Email verified' : 'Verify email →'}</button><p className="auth-switch"><Link to="/login">Back to sign in</Link></p></AuthLayout>
}
