import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authRequest } from './api'
import { AuthHeading, AuthLayout } from './AuthLayout'
import { AuthInput, PasswordInput } from './AuthControls'
import { passwordError, useEmailToken } from './authUtils'

export function RecoveryPage({ mode }: { mode: 'forgot' | 'reset' }) {
  const location = useLocation()
  return <RecoveryForm key={`${mode}:${location.key}`} mode={mode}/>
}

function RecoveryForm({ mode }: { mode: 'forgot' | 'reset' }) {
  const reset = mode === 'reset'
  const token = useEmailToken(reset ? '/reset-password' : '/forgot-password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({})
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || complete) return
    const next = reset ? { password: passwordError(password), confirm: password === confirm ? undefined : 'Passwords do not match.' } : { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address.' }
    setErrors(next); setNotice(null)
    if (Object.values(next).some(Boolean)) return
    setPending(true)
    try {
      const result = await authRequest<{ message: string }>(reset ? 'reset-password' : 'forgot-password', reset ? { token, password, confirmPassword: confirm } : { email: email.trim() })
      setNotice({ kind: 'success', text: result.message }); setPassword(''); setConfirm(''); setComplete(true)
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to complete request. Try again.' }) }
    finally { setPending(false) }
  }
  return <AuthLayout variant="auth-page--recovery">
    <div className="auth-status-icon" aria-hidden="true">{complete ? '✓' : '↗'}</div>
    <AuthHeading title={reset ? 'Set a new password' : 'Forgot password?'} subtitle={reset ? 'Choose a new password to secure your workspace.' : 'It happens. We’ll email you a link to reset it.'}/>
    {reset && !token ? <p role="alert" className="auth-notice auth-notice--error">Reset link is invalid or missing. Request a new link.</p> : !complete && <form onSubmit={submit} noValidate aria-busy={pending}>
      <fieldset disabled={pending}>
        {reset ? <><PasswordInput id="new-password" name="password" label="New password" autoComplete="new-password" maxLength={128} helper value={password} onChange={event => setPassword(event.target.value)} error={errors.password} required/><PasswordInput id="confirm-password" name="confirmPassword" label="Confirm password" autoComplete="new-password" maxLength={128} value={confirm} onChange={event => setConfirm(event.target.value)} error={errors.confirm} required/></> : <AuthInput id="recovery-email" name="email" label="Email address" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} error={errors.email} required/>}
        <button className="auth-submit" type="submit">{pending ? 'Please wait…' : reset ? 'Reset password →' : 'Send reset link →'}</button>
      </fieldset>
    </form>}
    {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`auth-notice auth-notice--${notice.kind}`}>{notice.text}</p>}
    {reset && <p className="auth-switch"><Link to="/forgot-password">Request a new reset link</Link></p>}
    <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
    {!reset && <p className="auth-recovery-note">For your security, reset links expire after 30 minutes.</p>}
  </AuthLayout>
}
