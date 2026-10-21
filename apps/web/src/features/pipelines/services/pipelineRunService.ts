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
}
