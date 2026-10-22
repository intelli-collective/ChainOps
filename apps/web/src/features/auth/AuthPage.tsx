import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiAuthService, authRequest, subscribeToLogout } from './api'
import type { AuthService } from './types'
import { AuthHeading, AuthLayout, ProviderButtons } from './AuthLayout'
import { AuthInput, PasswordInput } from './AuthControls'
import { passwordError } from './authUtils'

type Fields = { fullName: string; email: string; password: string; acceptedTerms: boolean }
type Errors = Partial<Record<keyof Fields, string>>
const emptyFields = (): Fields => ({ fullName: '', email: '', password: '', acceptedTerms: false })

export function AuthPage({ mode, service = apiAuthService }: { mode: 'login' | 'register'; service?: AuthService }) {
  const location = useLocation()
  return <AuthForm key={`${mode}:${location.key}`} mode={mode} service={service} />
}

function AuthForm({ mode, service }: { mode: 'login' | 'register'; service: AuthService }) {
  const register = mode === 'register'
  const navigate = useNavigate()
  const [fields, setFields] = useState<Fields>(emptyFields)
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [information, setInformation] = useState<string | null>(null)
  const form = useRef<HTMLFormElement>(null)
  // App state is never persisted. Clear browser-restored DOM values on pageshow
  // as well, including Back/Forward cache restoration. Password managers may
  // independently offer saved credentials; autocomplete is only a browser hint.
  useEffect(() => {
    const clear = () => { form.current?.reset(); setFields(emptyFields()); setErrors({}); setNotice(null) }
    const unsubscribe = subscribeToLogout(clear)
    window.addEventListener('pageshow', clear)
    return () => { unsubscribe(); window.removeEventListener('pageshow', clear) }
  }, [])
  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
    setNotice(null)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const next: Errors = {}
    if (register && !fields.fullName.trim()) next.fullName = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = 'Enter a valid email address.'
    if (!fields.password) next.password = 'Enter your password.'
    else next.password = passwordError(fields.password)
    if (register && !fields.acceptedTerms) next.acceptedTerms = 'You must agree to continue.'
    setErrors(next); setNotice(null)
    const first = (Object.keys(next) as (keyof Fields)[]).find(key => !!next[key])
    if (first) { form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus(); return }
    setPending(true)
    try {
      const request = { ...fields, email: fields.email.trim(), fullName: fields.fullName.trim() }
      const result = register ? await service.register(request) : await service.login(request)
      setFields(previous => ({ ...previous, password: '' }))
      form.current?.reset()
      if (!register) { setFields(emptyFields()); navigate(result.nextPath ?? '/projects', { replace: true }) }
      else setNotice({ kind: 'success', text: result.message ?? 'Check your email to verify ownership before signing in.' })
    } catch (error) {
      setFields(previous => ({ ...previous, password: '' }))
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to complete sign-in. Please try again.' })
    } finally { setPending(false) }
  }
  return <AuthLayout variant={`auth-page--${mode}`}>
    <AuthHeading title={register ? 'Create your account' : 'Welcome back'} subtitle={register ? 'Start building with ChainOps' : 'Sign in to your ChainOps workspace'} />
    <form ref={form} onSubmit={submit} noValidate autoComplete="off" aria-busy={pending}>
      <fieldset disabled={pending}>
        {register && <AuthInput id="fullName" name="fullName" label="Full name" autoComplete="name" maxLength={120} placeholder="Your full name" value={fields.fullName} onChange={event => update('fullName', event.target.value)} error={errors.fullName} required/>}
        <AuthInput id="email" name="email" type="email" label="Email address" autoComplete="off" maxLength={254} placeholder="you@example.com" value={fields.email} onChange={event => update('email', event.target.value)} error={errors.email} required/>
        <PasswordInput id="password" name="password" autoComplete={register ? 'new-password' : 'off'} maxLength={128} helper value={fields.password} onChange={event => update('password', event.target.value)} error={errors.password} required/>
        {register ? <><div className="auth-consent"><input id="acceptedTerms" name="acceptedTerms" type="checkbox" checked={fields.acceptedTerms} onChange={event => update('acceptedTerms', event.target.checked)} aria-invalid={!!errors.acceptedTerms} aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}/><label htmlFor="acceptedTerms">I agree to the <button type="button" className="auth-text-button" onClick={() => setInformation('Terms of Service')}>Terms of Service</button> and <button type="button" className="auth-text-button" onClick={() => setInformation('Privacy Policy')}>Privacy Policy</button>.</label></div>{errors.acceptedTerms && <p id="terms-error" className="auth-error">{errors.acceptedTerms}</p>}</> : <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>}
        <button type="submit" className="auth-submit">{pending ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign in')}<span aria-hidden="true"> →</span></button>
      </fieldset>
    </form>
    {notice && <p className={`auth-notice auth-notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
    <ProviderButtons/>
    <p className="auth-switch">{register ? 'Already have an account?' : 'New to ChainOps?'}{' '}<Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
    <button className="auth-text-button auth-resend" disabled={pending || !fields.email} onClick={async () => {
      setPending(true)
      try { const result = await authRequest<{ message: string }>('verification/resend', { email: fields.email }); setNotice({ kind: 'success', text: result.message }) }
      catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to send verification email' }) }
      finally { setPending(false) }
    }}>Resend verification email</button>
    {information && <div className="auth-modal-backdrop"><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" onKeyDown={event => { if (event.key === 'Escape') setInformation(null) }}>
      <h2 id="info-title">{information}</h2><p>The approved legal document has not been provided. Contact your workspace administrator for the current policy.</p>
      <button type="button" className="auth-submit" autoFocus onClick={() => { setInformation(null); form.current?.querySelector<HTMLInputElement>('input')?.focus() }} onKeyDown={event => { if (event.key === 'Tab') event.preventDefault() }}>Close</button>
    </section></div>}
  </AuthLayout>
}
