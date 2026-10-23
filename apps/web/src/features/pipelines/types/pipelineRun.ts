// Mirrors the M1 pipeline API (apps/api/src/pipelines). `error` means the run could not
// execute (infrastructure), which is different from `failed` (the project's build/tests failed).
export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'error'

export type RunTrigger = 'push' | 'pull_request' | 'manual'

export interface PipelineRun {
  id: string
  projectId: string
  runNumber: number
  /** Exact 40-character commit SHA the run builds. */
  commitSha: string
  branch: string
  repository: string
  trigger: RunTrigger
  status: RunStatus
  author: string
  /** ISO 8601 timestamps. */
  queuedAt: string
  startedAt: string
  finishedAt: string | null
  /** Null while the run is queued or still running. */
  durationSeconds: number | null
  cancelRequested: boolean
}

export type StageKey = 'checkout' | 'build' | 'test' | 'slither' | 'policy'

export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped'

export interface PipelineStageError {
  message: string
  detail?: string
}

export interface PipelineStage {
  key: StageKey
  name: string
  status: StageStatus
  startedAt: string | null
  finishedAt: string | null
  /** Null when the stage has not finished. */
  durationSeconds: number | null
  /** Plain-text output lines. Always rendered as text, never as HTML. */
  logs: string[]
  skipReason: string | null
  error?: PipelineStageError
}

export interface RunConfigSnapshot {
  framework: PipelineFramework
  buildCommand: string
  testCommand: string
  slitherConfig: string | null
  stages: string[]
}

export interface PipelineRunDetails extends PipelineRun {
  rerunOf: string | null
  failureStage: StageKey | null
  failureReason: string | null
  config: RunConfigSnapshot
  artifactCount: number
  contracts: string[]
  stages: PipelineStage[]
}

export interface PipelineRunFilters {
  search: string
  status: RunStatus | 'all'
  branch: string | 'all'
  /** Inclusive local dates in `YYYY-MM-DD` format; empty string means unbounded. */
  from: string
  to: string
}

export type PipelineFramework = 'hardhat' | 'foundry' | 'other'
export type PipelineTrigger = 'push' | 'pull_request' | 'tag'
export type ConfigStage = 'checkout' | 'compile' | 'build' | 'test' | 'security' | 'slither' | 'policy'

export interface PipelineConfig {
  id: string
  projectId: string
  name: string
  repository: string
  branch: string
  framework: PipelineFramework
  stages: ConfigStage[]
  buildCommand: string | null
  testCommand: string | null
  effectiveBuildCommand: string
  effectiveTestCommand: string
  triggers: PipelineTrigger[]
  slitherConfig: string | null
  createdAt: string
  updatedAt: string
}

export type PipelineConfigInput = Partial<Pick<PipelineConfig, 'name' | 'repository' | 'branch' | 'framework' | 'stages' | 'buildCommand' | 'testCommand' | 'triggers' | 'slitherConfig'>>

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  framework: PipelineFramework
  organizationName: string
}

export interface GitHubStatus {
  mode: 'public'
  tokenConfigured: boolean
  webhooks: 'not-configured'
}

export interface GitHubRepository {
  fullName: string
  name: string
  defaultBranch: string
  description: string | null
  updatedAt: string
}

export interface GitHubBranch {
  name: string
  commitSha: string
}

export interface ArtifactSummary {
  id: string
  runId: string
  contractName: string
  sourcePath: string
  artifactPath: string
  compilerVersion: string | null
  abiEntries: number
  bytecodeBytes: number
  deployedBytecodeBytes: number
  createdAt: string
}

export interface ArtifactDetails extends Omit<ArtifactSummary, 'abiEntries' | 'bytecodeBytes' | 'deployedBytecodeBytes'> {
  abi: unknown[]
  bytecode: string
  deployedBytecode: string
  metadata: Record<string, unknown>
}
