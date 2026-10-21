import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EthereumArtwork } from './EthereumArtwork'
import { demoAccount, mockAuthService } from './mockAuthService'
import type { AuthService } from './types'

type Fields = { fullName: string; email: string; password: string; acceptedTerms: boolean }
type Errors = Partial<Record<keyof Fields, string>>
const copy = {
  login: {
    title: 'Smart contract delivery, connected.',
    description: 'Build, review and deploy with one traceable workflow.',
    benefits: ['Build and security checks', 'Controlled deployments', 'Release history'],
  },
  register: {
    title: 'Bring your team’s releases together.',
    description: 'Keep your repositories, checks and deployments in one secure workspace.',
    benefits: ['Collaborate across teams', 'Automated testing and verification', 'Clear deployment audit trail'],
  },
}

export function AuthPage({ mode, service = mockAuthService }: {
  mode: 'login' | 'register'; service?: AuthService
}) {
  // Keying the form keeps credentials and messages from carrying between routes.
  return <AuthForm key={mode} mode={mode} service={service} />
}

function AuthForm({ mode, service }: { mode: 'login' | 'register'; service: AuthService }) {
  const register = mode === 'register'
  const content = copy[mode]
  const [fields, setFields] = useState<Fields>({ fullName: '', email: '', password: '', acceptedTerms: false })
  const [errors, setErrors] = useState<Errors>({})
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [information, setInformation] = useState<string | null>(null)
  const form = useRef<HTMLFormElement>(null)

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
    setNotice(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const next: Errors = {}
    if (register && !fields.fullName.trim()) next.fullName = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = 'Enter a valid email address.'
    if (!fields.password) next.password = 'Enter your password.'
    else if (register && (fields.password.length < 8 || !/\d/.test(fields.password) || !/[^\w\s]/.test(fields.password))) {
      next.password = 'Use at least 8 characters with a number and a symbol.'
    }
    if (register && !fields.acceptedTerms) next.acceptedTerms = 'You must agree to continue.'
    setErrors(next)
    setNotice(null)
    const first = Object.keys(next)[0]
    if (first) {
      form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
      return
    }
    setPending(true)
    try {
      const request = { ...fields, email: fields.email.trim(), fullName: fields.fullName.trim() }
      const result = register ? await service.register(request) : await service.login(request)
      setNotice({ kind: 'success', text: register
        ? `Demo registration succeeded for ${result.user.fullName}. No account was saved. You can try signing in with the demo credentials.`
        : `Demo sign-in succeeded for ${result.user.fullName}. No authenticated session was created.` })
      setFields((previous) => ({ ...previous, password: '' }))
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to complete the demo. Please try again.' })
    } finally {
      setPending(false)
    }
  }

  return <main className={`auth-page auth-page--${mode}`}>
    <section className="auth-intro" aria-label="About ChainOps">
      <EthereumArtwork />
      <div className="auth-intro-copy">
        <h2>{content.title}</h2>
        <p>{content.description}</p>
        <ul>{content.benefits.map((benefit) => <li key={benefit}><span className="auth-diamond" aria-hidden="true" />{benefit}</li>)}</ul>
      </div>
    </section>
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{register ? 'Create your account' : 'Welcome back'}</h1>
      <p className="auth-subtitle">{register ? 'Start building with ChainOps' : 'Sign in to your ChainOps workspace'}</p>
      <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending}>
          {register && <div className="auth-field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" autoComplete="name" placeholder="Daniel Smith" value={fields.fullName} onChange={(event) => update('fullName', event.target.value)} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? 'fullName-error' : undefined} required />
            {errors.fullName && <p className="auth-error" id="fullName-error">{errors.fullName}</p>}
          </div>}
          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@intellicoders.dev" value={fields.email} onChange={(event) => update('email', event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} required />
            {errors.email && <p className="auth-error" id="email-error">{errors.email}</p>}
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="auth-password">
              <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder="••••••••••" value={fields.password} onChange={(event) => update('password', event.target.value)} aria-invalid={!!errors.password} aria-describedby={[register ? 'password-hint' : '', errors.password ? 'password-error' : ''].filter(Boolean).join(' ') || undefined} required />
              <button className="auth-eye" type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg>
              </button>
            </div>
            {errors.password && <p className="auth-error" id="password-error">{errors.password}</p>}
          </div>
          {register ? <>
            <p className="auth-hint" id="password-hint">Use at least 8 characters with a number and a symbol.</p>
            <div className="auth-consent"><input id="acceptedTerms" name="acceptedTerms" type="checkbox" checked={fields.acceptedTerms} onChange={(event) => update('acceptedTerms', event.target.checked)} aria-invalid={!!errors.acceptedTerms} aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined} required />
              <label htmlFor="acceptedTerms">I agree to the <button type="button" className="auth-text-button" onClick={() => setInformation('Terms of Service')}>Terms of Service</button> and <button type="button" className="auth-text-button" onClick={() => setInformation('Privacy Policy')}>Privacy Policy</button>.</label>
            </div>
            {errors.acceptedTerms && <p id="terms-error" className="auth-error">{errors.acceptedTerms}</p>}
          </> : <button className="auth-text-button auth-forgot" type="button" onClick={() => setInformation('Password reset')}>Forgot password?</button>}
          <button type="submit" className="auth-submit">{pending ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account →' : 'Sign in →')}</button>
        </fieldset>
      </form>
      {notice && <p className={`auth-notice auth-notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to ChainOps?'}{' '}<Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      <aside className="auth-demo"><strong>Development demo — mock authentication</strong><br />No real account or session is created. Use test credentials only.{!register && <><br />Email: {demoAccount.email}<br />Password: {demoAccount.password}</>}</aside>
    </section>
    {information && <div className="auth-modal-backdrop"><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" onKeyDown={(event) => { if (event.key === 'Escape') setInformation(null) }}>
      <h2 id="info-title">{information}</h2>
      <p>{information === 'Password reset' ? 'Password reset is unavailable in this development demo. No reset email will be sent. Use the demo credentials shown on the sign-in page.' : 'The approved legal document has not been provided. This development demo does not create an account or record legal consent.'}</p>
      <button type="button" className="auth-submit" autoFocus onClick={() => { setInformation(null); form.current?.querySelector<HTMLInputElement>('input')?.focus() }} onKeyDown={(event) => { if (event.key === 'Tab') event.preventDefault() }}>Close</button>
    </section></div>}
  </main>
}
