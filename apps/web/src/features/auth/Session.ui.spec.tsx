import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoutes } from './Session'
import { restoreSession } from './api'
vi.mock('./api', () => ({ restoreSession: vi.fn(), authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
function mount() {
  render(<MemoryRouter initialEntries={['/projects']}><Routes><Route path="/login" element={<p>Sign in required</p>} /><Route element={<ProtectedRoutes />}><Route path="/projects" element={<p>Protected projects</p>} /></Route></Routes></MemoryRouter>)
}
it('redirects revoked or missing sessions to login', async () => {
  vi.mocked(restoreSession).mockResolvedValue(null)
  mount()
  expect(await screen.findByText('Sign in required')).toBeTruthy()
  expect(screen.queryByText('Protected projects')).toBeNull()
})
it('waits for a valid server session before displaying protected routes', async () => {
  let complete!: (value: Awaited<ReturnType<typeof restoreSession>>) => void
  vi.mocked(restoreSession).mockReturnValue(new Promise(resolve => { complete = resolve }))
  mount()
  expect(screen.getByRole('status').textContent).toContain('Restoring')
  expect(screen.queryByText('Protected projects')).toBeNull()
  complete({ user:{id:'member',email:'member@example.test',fullName:'Member'},organizations:[],nextPath:'/onboarding' })
  expect(await screen.findByText('Protected projects')).toBeTruthy()
})
