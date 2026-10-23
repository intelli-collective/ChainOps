import { restoreSession } from '../../auth/api'
import type {
  ArtifactDetails,
  ArtifactSummary,
  GitHubBranch,
  GitHubRepository,
  GitHubStatus,
  PipelineConfig,
  PipelineConfigInput,
  PipelineRun,
  PipelineRunDetails,
  PipelineStage,
  ProjectSummary,
} from '../types/pipelineRun'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function parseJson(text: string): unknown {
  try { return text ? JSON.parse(text) : null } catch { return null }
}

let csrf: string | undefined
async function csrfToken(): Promise<string> {
  if (!csrf) {
    const response = await fetch('/auth/csrf', { credentials: 'include' })
    if (!response.ok) throw new ApiError('Unable to prepare a secure request. Please try again.', response.status)
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken
  }
  return csrf
}

/**
 * Calls the M1 API through the `/api` dev proxy with the session cookie. Writes carry
 * the CSRF token. An expired access token is refreshed once through the shared auth flow.
 */
async function request<T>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}, retried = false): Promise<T> {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  } catch {
    throw new ApiError('Cannot reach the ChainOps API. Check that it is running and try again.', 0)
  }
  if (!retried && response.status === 401 && (await restoreSession())) return request(path, init, true)
  if (!retried && response.status === 403 && method !== 'GET') {
    // The CSRF cookie may have rotated (for example after signing in again).
    csrf = undefined
    const body = (await response.clone().json().catch(() => null)) as { message?: string } | null
    if (body?.message?.includes('CSRF')) return request(path, init, true)
  }
  const data = parseJson(await response.text())
  if (!response.ok) {
    const message = (data as { message?: unknown } | null)?.message
    throw new ApiError(typeof message === 'string' ? message : `Request failed (${response.status})`, response.status)
  }
  return data as T
}

const project = (projectId: string) => `/projects/${encodeURIComponent(projectId)}`

type ApiStage = Omit<PipelineStage, 'logs' | 'error'> & { log: string }
type ApiRunDetails = Omit<PipelineRunDetails, 'stages'> & { stages: ApiStage[] }

function toDetails(run: ApiRunDetails): PipelineRunDetails {
  return {
    ...run,
    stages: run.stages.map(({ log, ...stage }) => ({
      ...stage,
      logs: log ? log.replace(/\n+$/, '').split('\n') : [],
      ...(stage.status === 'failed' && run.failureStage === stage.key && run.failureReason ? { error: { message: run.failureReason } } : {}),
    })),
  }
}

export const pipelineApi = {
  lookupProject: (ref: string) => request<ProjectSummary>(`/pipeline-projects/lookup?ref=${encodeURIComponent(ref)}`),

  githubStatus: (projectId: string) => request<GitHubStatus>(`${project(projectId)}/github/status`),
  githubRepositories: (projectId: string, owner: string) =>
    request<GitHubRepository[]>(`${project(projectId)}/github/repositories?owner=${encodeURIComponent(owner)}`),
  githubBranches: (projectId: string, repository: string) =>
    request<GitHubBranch[]>(`${project(projectId)}/github/branches?repository=${encodeURIComponent(repository)}`),

  /** Resolves to null when the project has no pipeline configuration yet. */
  getConfig: async (projectId: string) => {
    try {
      return await request<PipelineConfig>(`${project(projectId)}/pipeline`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.message.startsWith('Pipeline configuration')) return null
      throw error
    }
  },
  createConfig: (projectId: string, body: PipelineConfigInput) => request<PipelineConfig>(`${project(projectId)}/pipeline`, { method: 'POST', body }),
  updateConfig: (projectId: string, body: PipelineConfigInput) => request<PipelineConfig>(`${project(projectId)}/pipeline`, { method: 'PATCH', body }),

  pipelineBranches: (projectId: string) =>
    request<{ repository: string; defaultBranch: string; branches: GitHubBranch[] }>(`${project(projectId)}/pipeline/branches`),
  listRuns: (projectId: string) => request<PipelineRun[]>(`${project(projectId)}/pipeline/runs`),
  startRun: (projectId: string, branch: string) => request<PipelineRun>(`${project(projectId)}/pipeline/runs`, { method: 'POST', body: { branch } }),
  getRun: async (projectId: string, runId: string) => toDetails(await request<ApiRunDetails>(`${project(projectId)}/pipeline/runs/${encodeURIComponent(runId)}`)),
  cancelRun: (projectId: string, runId: string) => request<PipelineRun>(`${project(projectId)}/pipeline/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', body: {} }),
  rerun: (projectId: string, runId: string) => request<PipelineRun>(`${project(projectId)}/pipeline/runs/${encodeURIComponent(runId)}/rerun`, { method: 'POST', body: {} }),
  listArtifacts: (projectId: string, runId: string) => request<ArtifactSummary[]>(`${project(projectId)}/pipeline/runs/${encodeURIComponent(runId)}/artifacts`),
  getArtifact: (projectId: string, runId: string, artifactId: string) =>
    request<ArtifactDetails>(`${project(projectId)}/pipeline/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`),
}

export type PipelineApi = typeof pipelineApi
