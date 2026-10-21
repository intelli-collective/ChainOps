import { buildRunDetails } from '../mocks/pipelineRunDetails'
import { pipelineRuns } from '../mocks/pipelineRuns'
import type { PipelineRun, PipelineRunService } from '../types/pipelineRun'

type MockScenario = 'default' | 'empty' | 'error'

/** Dev-only: append `?mock=empty` or `?mock=error` to the URL to preview those states. */
function getMockScenario(): MockScenario {
  if (!import.meta.env.DEV) return 'default'
  const value = new URLSearchParams(window.location.search).get('mock')
  return value === 'empty' || value === 'error' ? value : 'default'
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Development fixture service. No backend requests are made and no pipeline is executed. */
export const mockPipelineRunService: PipelineRunService = {
  async listRuns(projectId) {
    await delay(400)
    const scenario = getMockScenario()
    if (scenario === 'error') throw new Error('Unable to load pipeline runs')
    if (scenario === 'empty') return []
    return structuredClone(pipelineRuns.filter((run) => run.projectId === projectId))
  },
  async simulateRun(projectId, existingRuns) {
    await delay(300)
    const latest = existingRuns.reduce<PipelineRun | undefined>(
      (top, run) => (!top || run.runNumber > top.runNumber ? run : top),
      undefined,
    )
    const runNumber = (latest?.runNumber ?? 0) + 1
    return {
      id: `run-${runNumber}`,
      projectId,
      runNumber,
      commitSha: latest?.commitSha ?? '0000000',
      branch: 'main',
      trigger: 'manual',
      status: 'queued',
      author: 'You',
      startedAt: new Date().toISOString(),
      durationSeconds: null,
    }
  },
  async getRun(projectId, runId) {
    await delay(400)
    if (getMockScenario() === 'error') throw new Error('Unable to load pipeline run')
    const run = pipelineRuns.find((item) => item.projectId === projectId && item.id === runId)
    return run ? buildRunDetails(structuredClone(run)) : null
  },
  async simulateCancel(run) {
    await delay(300)
    const stages = run.stages.map((stage) => {
      if (stage.status === 'running') return { ...stage, status: 'cancelled' as const, logs: [...stage.logs, '[WARN] Run cancelled by user'] }
      if (stage.status === 'pending') return { ...stage, status: 'skipped' as const }
      return stage
    })
    return { ...run, status: 'cancelled', stages }
  },
}
