import type { MockScenario } from '../types'
import { eventsFixture } from './mocks'
import type { EventsSnapshot } from './types'

export interface EventsService {
  getEvents(projectId: string): Promise<EventsSnapshot>
}
export function createMockEventsService(scenario: MockScenario = 'success'): EventsService {
  return {
    async getEvents(projectId) {
      await new Promise<void>(resolve => setTimeout(resolve, 350))
      if (!projectId.trim()) throw new Error('A project must be selected.')
      if (scenario === 'error') throw new Error('Unable to load contract events. Please try again.')
      const snapshot = structuredClone(eventsFixture)
      return scenario === 'empty' ? { ...snapshot, events: [] } : snapshot
    },
  }
}
export const mockEventsService = createMockEventsService()
