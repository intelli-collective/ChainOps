import { restoreSession } from '../../features/auth/api'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let csrf: string | undefined
async function csrfToken(): Promise<string> {
  if (!csrf) {
    const response = await fetch('/auth/csrf', { credentials: 'include' })
    if (!response.ok) throw new ApiError('Unable to prepare a secure request. Please try again.', response.status)
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken
  }
  return csrf
}

function parseJson(text: string): unknown {
  try { return text ? JSON.parse(text) : null } catch { return null }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/**
 * Shared client for the ChainOps API (proxied as /api in development). Uses the
 * HttpOnly session cookie, sends the CSRF token on writes, and refreshes an expired
 * session once through the auth flow.
 */
export async function api<T>(path: string, init: { method?: Method; body?: unknown } = {}, retried = false): Promise<T> {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  let response: Response
  try {
    response = await fetch(`/api${path}`, { method, credentials: 'include', headers, ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }) })
  } catch {
    throw new ApiError('Cannot reach the ChainOps API. Check your connection and try again.', 0)
  }
  if (!retried && response.status === 401 && (await restoreSession())) return api(path, init, true)
  if (!retried && response.status === 403 && method !== 'GET') {
    const message = ((await response.clone().json().catch(() => null)) as { message?: string } | null)?.message
    if (message?.includes('CSRF')) { csrf = undefined; return api(path, init, true) }
  }
  const data = parseJson(await response.text())
  if (!response.ok) {
    const message = (data as { message?: unknown } | null)?.message
    throw new ApiError(typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : `Request failed (${response.status})`, response.status)
  }
  return data as T
}

export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => (error instanceof Error ? error.message : fallback)
