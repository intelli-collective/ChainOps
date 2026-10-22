import { afterEach, beforeEach, expect, it, vi } from 'vitest'
beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
it('restores expired access through one rotating refresh request', async () => {
  const profile = { user: { id: 'user' }, nextPath: '/projects' }
  const fetchMock = vi.fn().mockResolvedValueOnce(json({},401)).mockResolvedValueOnce(json({csrfToken:'csrf'})).mockResolvedValueOnce(json({ok:true})).mockResolvedValueOnce(json(profile))
  vi.stubGlobal('fetch',fetchMock)
  const { restoreSession } = await import('./api')
  expect(await restoreSession()).toEqual(profile)
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/auth/me','/auth/csrf','/auth/refresh','/auth/me'])
  expect(fetchMock.mock.calls[2][1]).toMatchObject({credentials:'include',headers:{'X-CSRF-Token':'csrf'}})
})
it('treats a revoked refresh session as signed out', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(json({},401)).mockResolvedValueOnce(json({csrfToken:'csrf'})).mockResolvedValueOnce(json({},401)))
  const { restoreSession } = await import('./api')
  expect(await restoreSession()).toBeNull()
})
it('rechecks shared cookies under a browser lock before rotating across tabs', async () => {
  const profile = { user: { id: 'member' }, nextPath: '/projects' }
  const fetchMock = vi.fn().mockResolvedValueOnce(json({},401)).mockResolvedValueOnce(json(profile)).mockResolvedValueOnce(json(profile))
  const lock = vi.fn(async (_name: string, work: () => Promise<unknown>) => work())
  vi.stubGlobal('navigator', { locks: { request: lock } })
  vi.stubGlobal('fetch', fetchMock)
  const { restoreSession } = await import('./api')
  expect(await restoreSession()).toEqual(profile)
  expect(lock).toHaveBeenCalled()
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/auth/me','/auth/me','/auth/me'])
})
it('sends credentials with HttpOnly-cookie requests and reports validation errors', async () => {
  const fetchMock=vi.fn().mockResolvedValueOnce(json({csrfToken:'csrf'})).mockResolvedValueOnce(json({message:'Invalid email or password'},401))
  vi.stubGlobal('fetch',fetchMock)
  const { apiAuthService }=await import('./api')
  await expect(apiAuthService.login({email:'member@example.test',password:'password'})).rejects.toThrow('Invalid email or password')
  expect(fetchMock.mock.calls[1][1]).toMatchObject({method:'POST',credentials:'include'})
})
