import { useEffect, useRef, useState } from 'react'
import type { ApprovedRelease, BuildArtifact, DeploymentRequest, DeploymentResult, DeploymentService } from '../types/deployment'

interface Props {
  projectId: string
  release: ApprovedRelease
  initialNetwork: string
  service: DeploymentService
  onBack: () => void
  historyHref: string
}

type ArtifactState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; artifacts: BuildArtifact[] }

export function DeploymentConfiguration({ projectId, release, initialNetwork, service, onBack, historyHref }: Props) {
  const [artifacts, setArtifacts] = useState<ArtifactState>({ status: 'loading' })
  const [artifactId, setArtifactId] = useState('')
  const [network, setNetwork] = useState(initialNetwork)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [attempt, setAttempt] = useState(0)
  const [review, setReview] = useState<DeploymentRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submissionLock = useRef(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<DeploymentResult | null>(null)

  useEffect(() => {
    let active = true
    service.getArtifacts(release.id).then((items) => {
      if (!active) return
      setArtifacts({ status: 'ready', artifacts: items })
      setArtifactId(items[0]?.id ?? '')
    }).catch(() => { if (active) setArtifacts({ status: 'error' }) })
    return () => { active = false }
  }, [service, release.id, attempt])

  function validate() {
    const next: Record<string, string> = {}
    if (artifacts.status !== 'ready' || !artifacts.artifacts.some((item) => item.id === artifactId)) next.artifact = 'Select a build artifact.'
    if (!release.allowedNetworks.includes(network)) next.network = 'Select an allowed network.'
    if (!name.trim()) next.name = 'Enter a deployment name.'
    else if (name.trim().length > 80) next.name = 'Use 80 characters or fewer.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSubmitError('')
    setReview({ projectId, releaseId: release.id, artifactId, network, deploymentName: name.trim() })
  }

  async function submit() {
    if (!review || submissionLock.current) return
    submissionLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await service.simulateDeployment(review)
      setResult(response)
      setReview(null)
    } catch {
      setSubmitError('The mock deployment could not be simulated. Your configuration is saved. Try again.')
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  const artifact = artifacts.status === 'ready' ? artifacts.artifacts.find((item) => item.id === artifactId) : undefined

  if (result) return (
    <section className="deployment-panel" aria-labelledby="result-heading">
      <h2 id="result-heading">Simulation completed</h2>
      <p role="status">{result.deploymentName} was simulated for {result.network}.</p>
      <p className="deployment-notice">Mock result only. No transaction was sent and no contract was deployed.</p>
      <dl className="deployment-summary"><dt>Simulation ID</dt><dd>{result.simulationId}</dd><dt>Release</dt><dd>{release.name}</dd><dt>Contract</dt><dd>{artifact?.contractName}</dd></dl>
      <button className="deployment-primary" onClick={onBack}>Prepare another deployment</button>
      <a className="deployment-history" href={historyHref}>Return to deployment history</a>
    </section>
  )

  return (
    <section className="deployment-panel" aria-labelledby="artifact-heading">
      <h2 id="artifact-heading">Configure deployment</h2>
      <p className="deployment-notice">Development preview · All data and deployment actions are mocked.</p>
      <p className="deployment-release-context">{release.name} · {release.commitSha} · Run #{release.runNumber}</p>
      {artifacts.status === 'loading' && <p role="status">Loading build artifacts…</p>}
      {artifacts.status === 'error' && <div><p role="alert">Build artifacts could not be loaded.</p><button className="deployment-secondary" onClick={() => { setArtifacts({ status: 'loading' }); setAttempt((value) => value + 1) }}>Try again</button></div>}
      {artifacts.status === 'ready' && !artifacts.artifacts.length && <p role="status">No build artifacts are available for this release. Choose another release.</p>}
      {artifacts.status === 'ready' && artifacts.artifacts.length > 0 && <form noValidate onSubmit={(event) => { event.preventDefault(); validate() }}>
        <div className="deployment-field">
          <label htmlFor="deployment-artifact">Build artifact</label>
          <select id="deployment-artifact" value={artifactId} aria-invalid={Boolean(errors.artifact)} aria-describedby={errors.artifact ? 'artifact-error' : undefined} onChange={(event) => { setArtifactId(event.target.value); setErrors({}) }}>
            {artifacts.artifacts.map((item) => <option key={item.id} value={item.id}>{item.contractName} · {item.source}</option>)}
          </select>
          {errors.artifact && <span className="deployment-error" id="artifact-error">{errors.artifact}</span>}
          {artifact && <span className="deployment-state">{artifact.compiler}</span>}
        </div>
        <div className="deployment-field">
          <label htmlFor="deployment-network">Target network</label>
          <select id="deployment-network" value={network} aria-invalid={Boolean(errors.network)} aria-describedby={errors.network ? 'network-error' : undefined} onChange={(event) => { setNetwork(event.target.value); setErrors({}) }}>
            <option value="" disabled>Select a network</option>
            {release.allowedNetworks.map((item) => <option key={item}>{item}</option>)}
          </select>
          {errors.network && <span className="deployment-error" id="network-error">{errors.network}</span>}
        </div>
        <div className="deployment-field">
          <label htmlFor="deployment-name">Deployment name</label>
          <input id="deployment-name" value={name} required maxLength={80} autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : 'name-help'} onChange={(event) => { setName(event.target.value); setErrors({}) }} />
          {errors.name ? <span className="deployment-error" id="name-error" role="alert">{errors.name}</span> : <span className="deployment-state" id="name-help">A name to identify this simulated deployment.</span>}
        </div>
        <button className="deployment-primary">Review deployment <span aria-hidden="true">→</span></button>
      </form>}
      <button className="deployment-back" onClick={onBack}>← Back to releases</button>
      {review && <ConfirmationDialog request={review} release={release} artifact={artifact} submitting={submitting} error={submitError} onCancel={() => setReview(null)} onConfirm={() => { void submit() }} />}
    </section>
  )
}

function ConfirmationDialog({ request, release, artifact, submitting, error, onCancel, onConfirm }: {
  request: DeploymentRequest
  release: ApprovedRelease
  artifact: BuildArtifact | undefined
  submitting: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="deployment-dialog" aria-labelledby="confirmation-heading" aria-describedby="confirmation-description" onCancel={(event) => { event.preventDefault(); if (!submitting) onCancel() }}>
    <h2 id="confirmation-heading">Review deployment</h2>
    <p id="confirmation-description" className="deployment-notice">This is a development simulation. No blockchain transaction will be sent.</p>
    <dl className="deployment-summary"><dt>Deployment</dt><dd>{request.deploymentName}</dd><dt>Release</dt><dd>{release.name} · {release.commitSha}</dd><dt>Artifact</dt><dd>{artifact?.contractName} · {artifact?.source}</dd><dt>Network</dt><dd>{request.network}</dd></dl>
    {error && <p role="alert" className="deployment-error">{error}</p>}
    <div className="deployment-actions"><button className="deployment-secondary" autoFocus disabled={submitting} onClick={onCancel}>Cancel</button><button className="deployment-primary" disabled={submitting} onClick={onConfirm}>{submitting ? 'Simulating…' : error ? 'Retry simulation' : 'Simulate deployment'}</button></div>
    {submitting && <p role="status" className="deployment-state">Simulating deployment. Please wait…</p>}
  </dialog>
}
