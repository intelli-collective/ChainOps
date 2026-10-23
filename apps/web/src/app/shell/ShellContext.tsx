import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authRequest, type Profile } from '../../features/auth/api'
import { platformApi, type Organization, type Project } from '../api/platform'
import { ShellContext, type ShellState } from './shellState'

const STORAGE_KEY = 'chainops.organization'

function storedOrganization(): string | null {
  try { return window.localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function ShellProvider({ projectRef, children }: { projectRef: string | null; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organizations, setOrganizations] = useState<Organization[] | null>(null)
  const [selected, setSelected] = useState<string | null>(storedOrganization)
  const [projectState, setProjectState] = useState<{ ref: string; project: Project | null; error: string | null } | null>(null)
  const [projectKey, setProjectKey] = useState(0)

  const refreshOrganizations = useCallback(async () => {
    try { setOrganizations(await platformApi.organizations()) } catch { setOrganizations((current) => current ?? []) }
  }, [])

  useEffect(() => {
    let active = true
    authRequest<Profile>('me').then((data) => { if (active) setProfile(data) }, () => undefined)
    platformApi.organizations().then((data) => { if (active) setOrganizations(data) }, () => { if (active) setOrganizations([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!projectRef) return
    let active = true
    platformApi.project(projectRef).then(
      (project) => { if (active) setProjectState({ ref: projectRef, project, error: null }) },
      (error: unknown) => { if (active) setProjectState({ ref: projectRef, project: null, error: error instanceof Error ? error.message : 'Project not found' }) },
    )
    return () => { active = false }
  }, [projectRef, projectKey])

  const selectOrganization = useCallback((id: string) => {
    setSelected(id)
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch { /* storage unavailable: selection lasts for this session */ }
  }, [])

  const value = useMemo<ShellState>(() => {
    const current = projectRef && projectState?.ref === projectRef ? projectState : null
    const project = current?.project ?? null
    const organization = organizations
      ? organizations.find((item) => item.id === (project?.organizationId ?? selected)) ?? organizations[0] ?? null
      : null
    return {
      profile, organizations, organization, selectOrganization, refreshOrganizations,
      project,
      projectStatus: !projectRef ? 'none' : !current ? 'loading' : current.project ? 'ready' : 'error',
      projectError: current?.error ?? null,
      refreshProject: () => setProjectKey((key) => key + 1),
    }
  }, [profile, organizations, selected, projectRef, projectState, selectOrganization, refreshOrganizations])

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}
