import { createContext, useContext } from 'react'
import type { Profile } from '../../features/auth/api'
import type { Organization, Project } from '../api/platform'

export interface ShellState {
  profile: Profile | null
  organizations: Organization[] | null
  /** The active organization: the current project's, else the remembered or first membership. */
  organization: Organization | null
  selectOrganization: (id: string) => void
  refreshOrganizations: () => Promise<void>
  project: Project | null
  projectStatus: 'none' | 'loading' | 'error' | 'ready'
  projectError: string | null
  refreshProject: () => void
}

export const ShellContext = createContext<ShellState | null>(null)

export function useShell(): ShellState {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell must be used inside ShellProvider')
  return value
}
