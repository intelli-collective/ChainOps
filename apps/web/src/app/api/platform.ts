import { api } from './client'

export type Role = 'owner' | 'developer' | 'reviewer' | 'viewer'
export const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', developer: 'Developer', reviewer: 'Reviewer', viewer: 'Viewer' }
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full access to project settings, members and critical actions.',
  developer: 'Create and modify code, run pipelines and manage deployments.',
  reviewer: 'Review code and approvals; view deployments and monitoring.',
  viewer: 'Read-only access to project resources and monitoring data.',
}

export interface Organization { id: string; name: string; slug: string; teamSize: string | null; createdAt: string; role: Role }
export interface OrganizationDetails extends Organization { permissions: { manageOrganization: boolean; createProject: boolean } }
export interface Invitation { id: string; organizationId: string; projectId: string | null; email: string; role: Role; status: 'draft' | 'pending' | 'accepted' | 'revoked' | 'expired'; expiresAt: string; createdAt: string }
export interface MyInvitation extends Invitation { organizationName: string; projectName: string | null; invitedBy: string | null }
export interface SentInvitation { invitation: Invitation; inviteLink: string | null; delivery: 'email' | 'link' | 'draft' }
export interface Member { userId: string; fullName: string; email: string; role: Role; joinedAt: string; status: 'active'; projectCount: number; isYou: boolean }
export interface ProjectSummary {
  id: string; name: string; slug: string; description: string | null; status: 'active' | 'paused' | 'archived'; framework: string; defaultBranch: string
  setupComplete: boolean; createdAt: string; repository: string | null; network: string | null; lastRun: { runNumber: number; status: string } | null
}
export interface Project {
  id: string; organizationId: string; organizationName: string; organizationSlug: string; name: string; slug: string; description: string | null
  status: 'active' | 'paused' | 'archived'; framework: string; defaultBranch: string; setupComplete: boolean; ownerName: string | null; createdAt: string; updatedAt: string
  access: { organizationRole: Role; projectRole: Role | null; canManage: boolean }
}
export interface TeamMember { userId: string; fullName: string; email: string; role: Role; addedAt: string; status: 'active'; isYou: boolean }
export interface Integrations {
  canManage: boolean
  github: { status: 'connected'; account: string; accountType: string; accessMode: string; connectedBy: string | null; connectedAt: string; lastCheckedAt: string } | { status: 'not_connected' }
  githubApp: { configured: boolean }
}
export interface Environment {
  id: string; name: string; description: string | null; network: string; chainId: number; rpcUrlMasked: string
  lastCheck: { at: string; ok: boolean | null; message: string | null } | null; createdAt: string; updatedAt: string
}
export interface Variable { id: string; key: string; environmentId: string | null; environmentName: string | null; isSecret: boolean; value: string | null; maskedValue: string; updatedAt: string; updatedBy: string | null }
export interface Notification { id: string; type: string; title: string; body: string; link: string | null; linkLabel: string | null; context: string | null; projectId: string | null; read: boolean; createdAt: string }
export interface Overview {
  repository: { repository: string; branch: string } | null
  environments: { name: string; network: string; chainId: number; healthy: boolean | null }[]
  latestRun: { id: string; runNumber: number; commitSha: string; status: string; stages: { key: string; status: string }[] } | null
  recentRuns: { id: string; runNumber: number; commitSha: string; status: string; branch: string; queuedAt: string; durationSeconds: number | null }[]
  security: { policies: number }
  approvals: { total: number; pending: number; latestTitle: string | null; latestStatus: string | null }
  contracts: { artifacts: number; latest: string | null }
  monitoring: { contracts: number; alertRules: number }
  activity: { day: string; runs: number }[]
}
export interface SearchResult { type: 'project' | 'run' | 'contract'; title: string; context: string; link: string }

const org = (id: string) => `/organizations/${encodeURIComponent(id)}`
const project = (id: string) => `/projects/${encodeURIComponent(id)}`

export const platformApi = {
  organizations: () => api<Organization[]>('/organizations'),
  createOrganization: (body: { name: string; slug: string; teamSize: string | null }) => api<Organization>('/organizations', { method: 'POST', body }),
  organization: (id: string) => api<OrganizationDetails>(org(id)),
  updateOrganization: (id: string, body: Partial<{ name: string; slug: string; teamSize: string | null }>) => api<Organization>(org(id), { method: 'PATCH', body }),
  projects: (orgId: string) => api<{ canCreate: boolean; projects: ProjectSummary[] }>(`${org(orgId)}/projects`),
  createProject: (orgId: string, body: { name: string; description: string | null; framework: string; defaultBranch: string }) => api<Project>(`${org(orgId)}/projects`, { method: 'POST', body }),
  members: (orgId: string) => api<{ role: Role; canManage: boolean; members: Member[]; invitations: Invitation[] }>(`${org(orgId)}/members`),
  changeMemberRole: (orgId: string, userId: string, role: Role) => api(`${org(orgId)}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeMember: (orgId: string, userId: string) => api(`${org(orgId)}/members/${userId}`, { method: 'DELETE' }),
  inviteToOrganization: (orgId: string, email: string, role: Role) => api<SentInvitation>(`${org(orgId)}/invitations`, { method: 'POST', body: { email, role } }),
  revokeOrganizationInvitation: (orgId: string, id: string) => api(`${org(orgId)}/invitations/${id}`, { method: 'DELETE' }),
  integrations: (orgId: string) => api<Integrations>(`${org(orgId)}/integrations`),
  connectGitHub: (orgId: string, account: string) => api<Integrations>(`${org(orgId)}/integrations/github`, { method: 'PUT', body: { account } }),
  disconnectGitHub: (orgId: string) => api<Integrations>(`${org(orgId)}/integrations/github`, { method: 'DELETE' }),

  project: (ref: string) => api<Project>(project(ref)),
  updateProject: (id: string, body: Partial<{ name: string; description: string | null; framework: string; defaultBranch: string; status: string }>) => api<Project>(project(id), { method: 'PATCH', body }),
  overview: (id: string) => api<Overview>(`${project(id)}/overview`),
  team: (id: string) => api<{ canManage: boolean; members: TeamMember[]; invitations: Invitation[] }>(`${project(id)}/team`),
  changeProjectRole: (id: string, userId: string, role: Role) => api(`${project(id)}/team/${userId}`, { method: 'PATCH', body: { role } }),
  inviteToProject: (id: string, email: string, role: Role) => api<SentInvitation>(`${project(id)}/invitations`, { method: 'POST', body: { email, role } }),
  revokeProjectInvitation: (id: string, invitationId: string) => api(`${project(id)}/invitations/${invitationId}`, { method: 'DELETE' }),
  completeSetup: (id: string) => api<{ projectId: string; invitations: SentInvitation[] }>(`${project(id)}/complete-setup`, { method: 'POST', body: {} }),

  environments: (id: string) => api<{ canManage: boolean; environments: Environment[] }>(`${project(id)}/environments`),
  createEnvironment: (id: string, body: { name: string; description: string | null; network: string; chainId: number; rpcUrl: string }) => api<Environment>(`${project(id)}/environments`, { method: 'POST', body }),
  updateEnvironment: (id: string, envId: string, body: Record<string, unknown>) => api<Environment>(`${project(id)}/environments/${envId}`, { method: 'PATCH', body }),
  deleteEnvironment: (id: string, envId: string) => api(`${project(id)}/environments/${envId}`, { method: 'DELETE' }),
  checkEnvironment: (id: string, envId: string) => api<Environment>(`${project(id)}/environments/${envId}/check`, { method: 'POST', body: {} }),
  variables: (id: string) => api<{ canManage: boolean; variables: Variable[] }>(`${project(id)}/variables`),
  createVariable: (id: string, body: { key: string; value: string; isSecret: boolean; environmentId: string | null }) => api<Variable>(`${project(id)}/variables`, { method: 'POST', body }),
  updateVariable: (id: string, variableId: string, body: { value?: string; isSecret?: boolean }) => api<Variable>(`${project(id)}/variables/${variableId}`, { method: 'PATCH', body }),
  deleteVariable: (id: string, variableId: string) => api(`${project(id)}/variables/${variableId}`, { method: 'DELETE' }),

  myInvitations: () => api<MyInvitation[]>('/invitations/mine'),
  invitationByToken: (token: string) => api<MyInvitation | null>(`/invitations/by-token/${encodeURIComponent(token)}`),
  acceptInvitation: (id: string) => api<{ organizationId: string; projectId: string | null; role: Role }>(`/invitations/${id}/accept`, { method: 'POST', body: {} }),

  notifications: (limit = 50) => api<{ unreadCount: number; items: Notification[] }>(`/notifications?limit=${limit}`),
  markNotificationRead: (id: string) => api(`/notifications/${id}/read`, { method: 'POST', body: {} }),
  markAllNotificationsRead: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST', body: {} }),

  search: (q: string) => api<{ query: string; results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`),
}
