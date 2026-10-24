import { useEffect, useState } from 'react'
import { ReleaseSelection } from '../components/ReleaseSelection'
import { DeploymentConfiguration } from '../components/DeploymentConfiguration'
import { mockDeploymentService } from '../services/deploymentService'
import type { ApprovedRelease, DeploymentService } from '../types/deployment'
import '../deployment.css'

interface DeploymentPageProps {
  projectId: string
  onContinueToArtifact?: (release: ApprovedRelease) => void
  historyHref: string
  network?: string
  service?: DeploymentService
}

type ReleaseState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; releases: ApprovedRelease[] }

/** Feature content only: the platform owner supplies the shell and route context. */
export function DeploymentPage({ projectId, onContinueToArtifact, historyHref, network = 'Sepolia Testnet', service = mockDeploymentService }: DeploymentPageProps) {
  return <DeploymentFlow key={`${projectId}:${network}`} projectId={projectId} onContinueToArtifact={onContinueToArtifact} historyHref={historyHref} network={network} service={service} />
}

function DeploymentFlow({ projectId, onContinueToArtifact, historyHref, network = 'Sepolia Testnet', service = mockDeploymentService }: DeploymentPageProps) {
  const [state, setState] = useState<ReleaseState>({ status: 'loading' })
  const [releaseId, setReleaseId] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [configuring, setConfiguring] = useState(false)

  useEffect(() => {
    let active = true
    service.getApprovedReleases(projectId).then((releases) => {
      if (!active) return
      setState({ status: 'ready', releases })
      setReleaseId(releases[0]?.id ?? '')
    }).catch(() => {
      if (active) setState({ status: 'error' })
    })
    return () => { active = false }
  }, [projectId, service, attempt])

  function continueToArtifact() {
    if (state.status !== 'ready') return
    const release = state.releases.find((item) => item.id === releaseId)
    if (release && release.buildPassed && release.approvals >= release.requiredApprovals && release.allowedNetworks.includes(network)) {
      setConfiguring(true)
      onContinueToArtifact?.(release)
    }
  }

  return (
    <main className="deployment-page">
      <nav className="deployment-breadcrumb" aria-label="Breadcrumb"><span>{configuring ? 'Deployments' : 'Release'}</span><span aria-hidden="true">›</span><span aria-current="page">{configuring ? 'New deployment' : 'Prepare a deployment'}</span></nav>
      <h1>{configuring ? 'Deploy Contract' : 'Prepare a deployment'}</h1>
      <p className="deployment-intro">{configuring ? 'Deploy a compiled contract from an approved pipeline run to a network.' : 'Choose an approved release before configuring a deployment.'}</p>
      {state.status === 'loading' && <section className="deployment-panel deployment-state" role="status">Loading approved releases…</section>}
      {state.status === 'error' && <section className="deployment-panel"><h2>Unable to load releases</h2><p role="alert">Approved releases could not be loaded. Please try again.</p><button className="deployment-primary" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Try again</button></section>}
      {state.status === 'ready' && configuring && state.releases.find((item) => item.id === releaseId) && <DeploymentConfiguration key={releaseId} projectId={projectId} release={state.releases.find((item) => item.id === releaseId)!} initialNetwork={network} service={service} onBack={() => setConfiguring(false)} historyHref={historyHref} />}
      {state.status === 'ready' && !configuring && (state.releases.length ? <ReleaseSelection releases={state.releases} releaseId={releaseId} network={network} onSelect={setReleaseId} onContinue={continueToArtifact} historyHref={historyHref} /> : <section className="deployment-panel"><h2>No approved releases</h2><p className="deployment-state" role="status">There are no approved releases available for this project.</p><a className="deployment-history" href={historyHref}>Return to deployment history</a></section>)}
    </main>
  )
}
