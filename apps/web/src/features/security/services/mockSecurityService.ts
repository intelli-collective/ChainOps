import { createSecurityFixtures, mockProjectId } from '../mocks/securityFixtures'
import type { SecurityScan, SecurityService } from '../types/security'

export type MockScenario = 'populated' | 'empty' | 'error' | 'loading' | 'running' | 'failed' | 'clean' | 'run-error'

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/** Explicitly development-only: never executes Slither, persists data, or gates a release. */
export function createMockSecurityService(scenario: MockScenario = 'populated'): SecurityService {
  let scans = createSecurityFixtures()
  let nextScan = 131
  const assertDevelopment = () => {
    if (!import.meta.env.DEV) throw new Error('Mock security data is only available in development. Connect the security API.')
  }

  return {
    source: 'mock',
    async listScans(projectId, signal) {
      assertDevelopment()
      await delay(scenario === 'loading' ? 60_000 : 350, signal)
      if (scenario === 'error') throw new Error('Unable to load mock scans. Retry or choose the populated preview.')
      if (projectId !== mockProjectId || scenario === 'empty') return []
      if (scenario === 'failed') return structuredClone(scans.filter(scan => scan.status === 'failed'))
      if (scenario === 'running') return [{ ...structuredClone(scans[0]), status: 'running', findings: [], policy: null }]
      if (scenario === 'clean') return [{ ...structuredClone(scans[0]), findings: [], policy: { decision: 'passed', reason: 'No findings in this mock scan.' } }]
      return structuredClone(scans)
    },
    async runAnalysis(projectId, signal) {
      assertDevelopment()
      if (projectId !== mockProjectId) throw new Error('This development fixture only supports the chainvault project.')
      await delay(1200, signal)
      if (scenario === 'run-error') throw new Error('Simulated analyzer failure. Previous results have been preserved.')
      const number = nextScan++
      const scan: SecurityScan = {
        ...structuredClone(createSecurityFixtures()[0]),
        id: `mock-scan-${number}`,
        number,
        startedAt: new Date().toISOString(),
      }
      scans = [scan, ...scans]
      return structuredClone(scan)
    },
  }
}
