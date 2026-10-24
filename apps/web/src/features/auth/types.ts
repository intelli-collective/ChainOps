export interface LoginRequest { email: string; password: string }
export interface RegisterRequest extends LoginRequest { fullName: string; acceptedTerms: boolean }
export interface AuthResponse {
  mode?: 'mock'
  user?: { id: string; email: string; fullName: string }
  nextPath?: string
  verificationRequired?: boolean
  message?: string
}
export interface AuthService {
  login(request: LoginRequest): Promise<AuthResponse>
  register(request: RegisterRequest): Promise<AuthResponse>
}
