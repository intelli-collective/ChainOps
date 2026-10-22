import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AuthLayout({ children, variant = '' }: { children: ReactNode; variant?: string }) {
  return <main className={`auth-page ${variant}`}>
    <section className="auth-intro" aria-label="About ChainOps">
      <Link className="auth-brand" to="/" aria-label="ChainOps home"><img src="/logo-1.png" alt="" /><span>ChainOps</span></Link>
      <img className="auth-artwork" src="/chainops-auth-artwork.jpeg" alt="" aria-hidden="true" />
      <div className="auth-intro-copy">
        <h2>Smart contract delivery, <span>connected.</span></h2>
        <p>Build, review and deploy with one traceable workflow.</p>
        <ul>{['Build and security checks', 'Controlled deployments', 'Release history'].map(text => <li key={text}><span className="auth-feature-icon" aria-hidden="true"><span /></span>{text}</li>)}</ul>
      </div>
    </section>
    <section className="auth-card" aria-labelledby="auth-title">{children}</section>
  </main>
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className="auth-card-heading"><h1 id="auth-title">{title}</h1><p className="auth-subtitle">{subtitle}</p></header>
}

export function ProviderButtons() {
  return <div className="auth-providers"><div className="auth-divider"><span>or continue with</span></div>
    <button className="auth-provider" type="button" disabled aria-label="Continue with Google — Coming soon">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.9 2.8-4.4 2.8-7.6Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.5l-3.4-2.6c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.8v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.7a6 6 0 0 1 0-3.4V7.6H2.8a10 10 0 0 0 0 8.8l3.5-2.7Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l3-3A10 10 0 0 0 2.8 7.6l3.5 2.7A6 6 0 0 1 12 6.1Z"/></svg>
      <span>Continue with Google</span><small>Coming soon</small>
    </button>
    <button className="auth-provider" type="button" disabled aria-label="Continue with GitHub — Coming soon">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.5 21.8c.6.1.8-.2.8-.5v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.3-1.2-1.6-1.2-1.6-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.8-.3-5.7-1.4-5.7-6.2 0-1.4.5-2.5 1.2-3.4-.1-.3-.5-1.6.2-3.3 0 0 1-.3 3.5 1.3a12 12 0 0 1 6.4 0C18.5 3.6 19.5 4 19.5 4c.7 1.7.3 3 .2 3.3.8.9 1.2 2 1.2 3.4 0 4.8-2.9 5.9-5.7 6.2.5.4.9 1.1.9 2.2v3c0 .3.2.6.8.5A11.2 11.2 0 0 0 12 .8Z"/></svg>
      <span>Continue with GitHub</span><small>Coming soon</small>
    </button>
  </div>
}
