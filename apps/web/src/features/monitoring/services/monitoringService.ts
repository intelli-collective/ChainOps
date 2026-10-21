import { monitoringFixtures } from '../mocks/monitoring'
import type { MockScenario, MonitoringSnapshot, TimeRange } from '../types'

export interface MonitoringService {
  getOverview(projectId: string, range: TimeRange): Promise<MonitoringSnapshot>
}

export function createMockMonitoringService(scenario: MockScenario = 'success'): MonitoringService {
  return {
    async getOverview(projectId, range) {
      await new Promise<void>((resolve) => setTimeout(resolve, 350))
      if (!projectId.trim()) throw new Error('A project must be selected.')
      if (scenario === 'error') throw new Error('Unable to load the monitoring overview. Please try again.')
      const data = structuredClone(monitoringFixtures[range])
      return scenario === 'empty' ? { ...data, contracts: [], events: [], alerts: [], throughput: [], eventRate: 0 } : data
    },
  }
}

export const mockMonitoringService = createMockMonitoringService()
