import type { Member2Service } from '../types/member2'

async function request<T>(
  projectId: string,
  path: string,
  body?: unknown,
  key?: string
): Promise<T> {
  let csrf: string | undefined
  if (body !== undefined) {
    const token = await fetch('/auth/csrf', { credentials: 'include' })
    if (!token.ok)
      throw new Error('Unable to initialize request. Sign in and try again.')
    csrf = ((await token.json()) as { csrfToken: string }).csrfToken
  }
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/release/${path}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: {
        ...(csrf
          ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
          : {}),
        ...(key ? { 'Idempotency-Key': key } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }
  )
  const result = (await response.json().catch(() => ({}))) as {
    message?: string
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Your session expired. Sign in again.'
        : response.status === 403
          ? 'You do not have access to this project.'
          : (result.message ?? 'Unable to load release data. Try again.')
    )
  return result as T
}
export const member2Api: Member2Service = {
  artifacts: (p) => request(p, 'artifacts'),
  networks: (p) => request(p, 'networks'),
  deployments: (p) => request(p, 'deployments'),
  deployment: (p, id) => request(p, `deployments/${encodeURIComponent(id)}`),
  preflight: (p, draft) => request(p, 'preflight', draft),
  submit: (p, draft, key) => request(p, 'deployments', draft, key),
  reconcile: (p, id) =>
    request(p, `deployments/${encodeURIComponent(id)}/reconcile`, {}),
  contracts: (p) => request(p, 'registry'),
  contract: (p, id) => request(p, `registry/${encodeURIComponent(id)}`),
  register: (p, input) => request(p, 'registry', input)
}
