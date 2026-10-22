import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

export function AuthInput({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <div className="auth-field"><label htmlFor={props.id}>{label}</label><div className="auth-input-wrap">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">{props.type === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></> : <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>}</svg>
    <input {...props} aria-invalid={!!error} aria-describedby={error ? `${props.id}-error` : undefined}/>
  </div>{error && <p className="auth-error" id={`${props.id}-error`}>{error}</p>}</div>
}

export function PasswordInput({ label = 'Password', error, helper = false, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string; error?: string; helper?: boolean }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field"><div className="auth-field-label"><label htmlFor={props.id}>{label}</label>{helper && <span id={`${props.id}-hint`}>At least 8 characters</span>}</div>
    <div className="auth-input-wrap auth-password">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>
      <input {...props} type={visible ? 'text' : 'password'} placeholder="Enter your password" aria-invalid={!!error} aria-describedby={[helper ? `${props.id}-hint` : '', error ? `${props.id}-error` : ''].filter(Boolean).join(' ') || undefined}/>
      <button className="auth-eye" type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg>
      </button>
    </div>{error && <p className="auth-error" id={`${props.id}-error`}>{error}</p>}
  </div>
}
