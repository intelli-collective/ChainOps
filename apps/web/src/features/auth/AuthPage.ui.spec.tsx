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
it('shows verification dependency errors and retains provider links', async () => {
  mount('login',{login:vi.fn().mockRejectedValue(new Error('Verify your email before signing in')),register:vi.fn()}); fill()
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toContain('Verify your email')
  expect(screen.getByRole('link',{name:'Continue with Google'}).getAttribute('href')).toBe('/auth/google/start')
  expect(screen.getByRole('link',{name:'Continue with GitHub'}).getAttribute('href')).toBe('/auth/github/start')
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
