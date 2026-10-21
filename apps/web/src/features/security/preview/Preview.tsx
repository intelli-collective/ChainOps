import { useState } from 'react'
import { SecurityDashboard } from '../pages/SecurityDashboard'
import { createMockSecurityService } from '../services/mockSecurityService'
import type { MockScenario } from '../services/mockSecurityService'
import { mockProjectId } from '../mocks/securityFixtures'

const scenarios: MockScenario[] = ['populated', 'empty', 'error', 'loading', 'running', 'failed', 'clean', 'run-error']

export function Preview() {
  const [scenario, setScenario] = useState<MockScenario>('populated')
  const [service, setService] = useState(() => createMockSecurityService())
  const [destination, setDestination] = useState('')
  return <>
    <div className="security-dashboard" style={{ minHeight: 0, paddingBottom: 0 }}>
      <label>Development scenario <select aria-label="Development scenario" value={scenario} onChange={event => {
        const next = scenarios.find(item => item === event.target.value) ?? 'populated'
        setScenario(next)
        setService(createMockSecurityService(next))
        setDestination('')
      }}>{scenarios.map(item => <option key={item}>{item}</option>)}</select></label>
      {destination && <p role="status">Navigation requested: <code>{destination}</code>. M5 must register this route; scan details are outside Issue #26.</p>}
    </div>
    <SecurityDashboard key={scenario} projectId={mockProjectId} service={service} onNavigate={setDestination} />
  </>
}
