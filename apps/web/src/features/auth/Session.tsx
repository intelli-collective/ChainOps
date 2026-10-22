import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { authRequest, restoreSession } from './api'

export function ProtectedRoutes() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized'>('loading')
  const location = useLocation()
  useEffect(() => {
    let active = true
    const check = async () => { const profile = await restoreSession(); if (active) setStatus(profile ? 'ready' : 'unauthorized') }
    void check()
    const interval = window.setInterval(() => { void check() }, 8 * 60 * 1000)
    return () => { active = false; window.clearInterval(interval) }
  }, [location.pathname])
  if (status === 'loading') return <p role="status">Restoring your session…</p>
  return status === 'ready' ? <Outlet /> : <Navigate to="/login" replace />
}

export function VerifyEmail() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'))
  const [message, setMessage] = useState('Confirm your email ownership to continue.')
  const [pending, setPending] = useState(false)
  useEffect(() => { window.history.replaceState(null, '', '/verify-email') }, [])
  return <main className="auth-card"><h1>Verify your email</h1><p role="status">{message}</p><button disabled={!token || pending} onClick={async () => {
    setPending(true)
    try { const result = await authRequest<{ message: string }>('verify-email', { token }); setMessage(result.message) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to verify email') }
    finally { setPending(false) }
  }}>Verify email</button><p><Link to="/login">Sign in</Link></p></main>
}
