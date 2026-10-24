import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecoveryPage } from './RecoveryPage'
import { authRequest } from './api'
vi.mock('./api', () => ({ authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState(null, '', '/') })
function mount(mode: 'forgot' | 'reset', token?: string) {
  window.history.replaceState(null, '', token ? `/reset-password#token=${token}` : '/')
  render(<MemoryRouter><RecoveryPage mode={mode}/></MemoryRouter>)
}
it('requests recovery and shows the generic email response', async () => {
  vi.mocked(authRequest).mockResolvedValue({message:'If eligible, a reset link will be sent.'})
  mount('forgot'); fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'member@example.test'}})
  fireEvent.click(screen.getByRole('button',{name:'Send reset link →'}))
  expect(await screen.findByRole('status')).toBeTruthy()
  expect(authRequest).toHaveBeenCalledWith('forgot-password',{email:'member@example.test'})
})
it('validates password length and confirmation before submitting the token', async () => {
  vi.mocked(authRequest).mockResolvedValue({message:'Password updated.'})
  mount('reset','t'.repeat(43)); expect(window.location.hash).toBe('')
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'1234567'}})
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'different'}})
  fireEvent.click(screen.getByRole('button',{name:'Reset password →'}))
  expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy()
  expect(screen.getByText('Passwords do not match.')).toBeTruthy(); expect(authRequest).not.toHaveBeenCalled()
  for (const label of ['New password','Confirm password']) fireEvent.change(screen.getByLabelText(label),{target:{value:'12345678'}})
  fireEvent.click(screen.getByRole('button',{name:'Reset password →'}))
  expect(await screen.findByText('Password updated.')).toBeTruthy()
  expect(authRequest).toHaveBeenCalledWith('reset-password',{token:'t'.repeat(43),password:'12345678',confirmPassword:'12345678'})
  expect(screen.queryByLabelText('New password')).toBeNull()
})
it('handles missing and server-rejected reset tokens', async () => {
  mount('reset'); expect(screen.getByRole('alert').textContent).toContain('invalid or missing'); cleanup()
  vi.mocked(authRequest).mockRejectedValue(new Error('Reset link is invalid, expired, or already used.'))
  mount('reset','t'.repeat(43)); for (const label of ['New password','Confirm password']) fireEvent.change(screen.getByLabelText(label),{target:{value:'12345678'}})
  fireEvent.click(screen.getByRole('button',{name:'Reset password →'}))
  expect((await screen.findByRole('alert')).textContent).toContain('expired')
})
