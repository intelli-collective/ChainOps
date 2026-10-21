import { useState } from 'react'
import { SecurityFindingDetailsPage } from '../pages/SecurityFindingDetailsPage'
import { mockProjectId } from '../mocks/securityFixtures'
import { createMockSecurityService } from '../services/mockSecurityService'
import type { MockScenario } from '../services/mockSecurityService'

type DetailScenario = 'populated' | 'sparse' | 'missing-scan' | 'missing-finding' | 'error' | 'loading' | 'clean'
const scenarios: DetailScenario[] = ['populated', 'sparse', 'missing-scan', 'missing-finding', 'error', 'loading', 'clean']

export function DetailPreview() {
  const [scenario, setScenario] = useState<DetailScenario>('populated')
  const [destination, setDestination] = useState('')
  const [service, setService] = useState(() => createMockSecurityService())
  const scanId = scenario === 'sparse' ? 'scan-129' : scenario === 'missing-scan' ? 'scan-missing' : 'scan-130'
  const findingId = scenario === 'sparse' ? 'SLT-009' : scenario === 'missing-finding' ? 'SLT-missing' : 'SLT-001'

  return <>
    <div className="security-dashboard" style={{ minHeight: 0, paddingBottom: 0 }}>
      <label>Development scenario <select aria-label="Development scenario" value={scenario} onChange={event => {
        const next = scenarios.find(item => item === event.target.value) ?? 'populated'
        setScenario(next)
        setService(createMockSecurityService(next === 'error' || next === 'loading' || next === 'clean' ? next as MockScenario : 'populated'))
        setDestination('')
      }}>{scenarios.map(item => <option key={item}>{item}</option>)}</select></label>
      <p role="note">Development preview · Mock data only. Acknowledgement is local to this view.</p>
      {destination && <p role="status">Navigation requested: <code>{destination}</code>. M5 will handle the shared route.</p>}
    </div>
    <SecurityFindingDetailsPage key={scenario} projectId={mockProjectId} scanId={scanId} findingId={findingId} service={service} onNavigate={setDestination} />
  </>
}
