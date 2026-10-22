import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthPage } from './AuthPage'
import type { AuthService } from './types'
afterEach(cleanup)
function mount(mode: 'login' | 'register', service: AuthService) {
  return render(<MemoryRouter initialEntries={[`/${mode}`]}><Routes><Route path={`/${mode}`} element={<AuthPage mode={mode} service={service}/>} /><Route path="/projects" element={<p>Projects overview</p>}/><Route path="/onboarding" element={<p>Organization onboarding</p>}/></Routes></MemoryRouter>)
}
function fill() {
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'member@example.test'}})
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'long test password'}})
}
it('takes an existing member to the projects overview after login', async () => {
  const login=vi.fn().mockResolvedValue({nextPath:'/projects'})
  mount('login',{login,register:vi.fn()}); fill()
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect(await screen.findByText('Projects overview')).toBeTruthy()
})
it('takes a user without a membership to organization onboarding', async () => {
  mount('login',{login:vi.fn().mockResolvedValue({nextPath:'/onboarding'}),register:vi.fn()}); fill()
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect(await screen.findByText('Organization onboarding')).toBeTruthy()
})
it('shows verification dependency errors and disables provider flows', async () => {
  mount('login',{login:vi.fn().mockRejectedValue(new Error('Verify your email before signing in')),register:vi.fn()}); fill()
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toContain('Verify your email')
  expect((screen.getByRole('button',{name:'Continue with Google — Coming soon'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button',{name:'Continue with GitHub — Coming soon'}) as HTMLButtonElement).disabled).toBe(true)
})
it.each(['pageshow','chainops:logout'])('clears credentials on %s', event => {
  mount('login',{login:vi.fn(),register:vi.fn()}); fill()
  fireEvent(window, new Event(event))
  expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
})
it('rejects seven characters and accepts an eight-character registration password', async () => {
  const register=vi.fn().mockResolvedValue({message:'Check your email'})
  mount('register',{login:vi.fn(),register}); fill()
  fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Member'}}); fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'1234567'}})
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy(); expect(register).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'12345678'}})
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect(await screen.findByText('Check your email')).toBeTruthy()
})
it('keeps new registrations unauthenticated pending email verification', async () => {
  const register=vi.fn().mockResolvedValue({verificationRequired:true,message:'Check your email'})
  mount('register',{login:vi.fn(),register}); fill()
  fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Member'}})
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect(await screen.findByText('Check your email')).toBeTruthy()
  expect(screen.queryByText('Organization onboarding')).toBeNull()
})
