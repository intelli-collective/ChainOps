import type { AuthService, AuthResponse } from './types'

// Development fixture only. No credentials or sessions are persisted.
export const demoAccount = { email: 'demo@chainops.dev', password: 'ChainOps1!' }
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 650))
const response = (email: string, fullName: string): AuthResponse => ({
  mode: 'mock', user: { id: 'mock-user', email, fullName },
})
export const mockAuthService: AuthService = {
  async login({ email, password }) {
    await delay()
    if (email.toLowerCase() !== demoAccount.email || password !== demoAccount.password) {
      throw new Error('The demo email or password is incorrect. Use the demo credentials below.')
    }
    return response(email, 'Demo User')
  },
  async register({ email, fullName, acceptedTerms }) {
    await delay()
    if (!acceptedTerms) throw new Error('Please accept the terms to continue.')
    if (email.toLowerCase() === demoAccount.email) throw new Error('This demo email is already registered. Try another email or sign in.')
    return response(email, fullName)
  },
}
