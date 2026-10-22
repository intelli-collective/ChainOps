import type { AuthService } from './types'
export type Profile = { user: { id: string; fullName: string; email: string }; organizations: { id: string; name: string }[]; nextPath: string }
let csrf: string | undefined
let refreshPending: Promise<unknown> | undefined
async function csrfToken() {
  if (!csrf) {
    const response = await fetch('/auth/csrf', { credentials: 'include' })
    if (!response.ok) throw new Error('Unable to initialize sign-in. Please try again.')
    csrf = (await response.json() as { csrfToken: string }).csrfToken
  }
  return csrf!
}
export async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrfToken() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json() as { message?: string }
  if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Unable to complete request')
  return result as T
}
export async function restoreSession(): Promise<Profile | null> {
  try { return await authRequest<Profile>('me') } catch {
    try {
      // Tabs share cookies. Recheck after acquiring the browser lock so a second
      // tab does not replay a refresh token another tab has already rotated.
      const rotate = async () => {
        if (typeof navigator !== 'undefined' && navigator.locks) {
          return navigator.locks.request('chainops-session-refresh', async () => {
            try { await authRequest<Profile>('me') } catch { await authRequest('refresh', {}) }
          })
        }
        return authRequest('refresh', {})
      }
      refreshPending ??= rotate().finally(() => { refreshPending = undefined })
      await refreshPending
      return await authRequest<Profile>('me')
    } catch { csrf = undefined; return null }
  }
}
export const apiAuthService: AuthService = {
  login: request => authRequest('login', request),
  register: request => authRequest('register', request),
}
export async function logout() { await authRequest('logout', {}); csrf = undefined }
