import { useEffect, useRef, useState } from 'react'
import { ArtifactSelection } from './ArtifactSelection'
import type { ApprovedRelease, BuildArtifact, DeploymentBuildRun, DeploymentRequest, DeploymentResult, DeploymentService } from '../types/deployment'

interface Props {
  projectId: string
  release: ApprovedRelease
  initialNetwork: string
  service: DeploymentService
  onBack: () => void
  historyHref: string
}

type BuildState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; artifacts: BuildArtifact[]; runs: DeploymentBuildRun[] }
type Step = 'Artifact' | 'Network' | 'Parameters' | 'Review'
const steps: Step[] = ['Artifact', 'Network', 'Parameters', 'Review']

export function DeploymentConfiguration({ projectId, release, initialNetwork, service, onBack, historyHref }: Props) {
  const [build, setBuild] = useState<BuildState>({ status: 'loading' })
  const [artifactId, setArtifactId] = useState('')
  const [runId, setRunId] = useState('')
  const [network, setNetwork] = useState(initialNetwork)
  const [name, setName] = useState('')
  const [step, setStep] = useState<Step>('Artifact')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [attempt, setAttempt] = useState(0)
  const [review, setReview] = useState<DeploymentRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submissionLock = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<DeploymentResult | null>(null)

  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus()
    previousStep.current = step
  }, [step])

  useEffect(() => {
    let active = true
    Promise.all([service.getArtifacts(release.id), service.getBuildRuns(release.id)]).then(([items, runs]) => {
      if (!active) return
      setBuild({ status: 'ready', artifacts: items, runs })
      setArtifactId(items[0]?.id ?? '')
      setRunId(runs.find((run) => run.eligible && run.status === 'passed' && run.runNumber === release.runNumber && run.commitSha === release.commitSha)?.id ?? '')
    }).catch(() => { if (active) setBuild({ status: 'error' }) })
    return () => { active = false }
  }, [service, release.id, release.runNumber, release.commitSha, attempt])

  const artifact = build.status === 'ready' ? build.artifacts.find((item) => item.id === artifactId) : undefined
  const run = build.status === 'ready' ? build.runs.find((item) => item.id === runId) : undefined
  const eligible = artifact?.releaseId === release.id && run?.eligible && run.status === 'passed' && run.runNumber === release.runNumber && run.commitSha === release.commitSha

  function advance() {
    const next: Record<string, string> = {}
    if (!eligible) next.artifact = 'Select an eligible build run and contract artifact.'
    if (step !== 'Artifact' && !release.allowedNetworks.includes(network)) next.network = 'Select an allowed network.'
    if (step === 'Parameters' || step === 'Review') {
      if (!name.trim()) next.name = 'Enter a deployment name.'
      else if (name.trim().length > 80) next.name = 'Use 80 characters or fewer.'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    if (step === 'Review') {
      setSubmitError('')
      setReview({ projectId, releaseId: release.id, artifactId, network, deploymentName: name.trim() })
    } else setStep(steps[steps.indexOf(step) + 1])
  }

  async function submit() {
    if (!review || submissionLock.current) return
    submissionLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      setResult(await service.simulateDeployment(review))
      setReview(null)
    } catch {
      setSubmitError('The mock deployment could not be simulated. Your configuration is saved. Try again.')
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

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

  return <>
    <h2 className="deployment-sr-only" ref={stepHeading} tabIndex={-1}>{step} step</h2>
    <ol className="deployment-steps" aria-label="Deployment progress">{steps.map((item, index) => <li key={item} aria-current={step === item ? 'step' : undefined}>{index + 1} {item}</li>)}</ol>
    <div className="deployment-pinned-context" aria-label="Pinned release context">
      <span>Release context (pinned)</span><span>commit {release.commitSha}</span><span>run #{release.runNumber}</span><span>{release.name}</span><span>{initialNetwork}</span>
    </div>
    {build.status === 'loading' && <section className="deployment-choice-panel" role="status">Loading build runs and artifacts…</section>}
    {build.status === 'error' && <section className="deployment-choice-panel"><p role="alert">Build runs and artifacts could not be loaded.</p><button className="deployment-secondary" onClick={() => { setBuild({ status: 'loading' }); setAttempt((value) => value + 1) }}>Try again</button></section>}
    {build.status !== 'ready' && <button className="deployment-back" onClick={onBack}>← Back to releases</button>}
    {build.status === 'ready' && step === 'Artifact' && <ArtifactSelection release={release} artifacts={build.artifacts} runs={build.runs} artifactId={artifactId} runId={runId} onRunChange={setRunId} onArtifactChange={setArtifactId} onBack={onBack} onContinue={advance} />}
    {build.status === 'ready' && step !== 'Artifact' && <form noValidate onSubmit={(event) => { event.preventDefault(); advance() }}>
      <section className="deployment-choice-panel deployment-configuration-panel">
        <h2>{step === 'Network' ? 'Select target network' : step === 'Parameters' ? 'Deployment parameters' : 'Review deployment'}</h2>
        {step === 'Network' && <div className="deployment-field">
          <label htmlFor="deployment-network">Target network</label>
          <select id="deployment-network" value={network} aria-invalid={Boolean(errors.network)} aria-describedby={errors.network ? 'network-error' : undefined} onChange={(event) => { setNetwork(event.target.value); setErrors({}) }}>
            <option value="" disabled>Select a network</option>
            {release.allowedNetworks.map((item) => <option key={item}>{item}</option>)}
          </select>
          {errors.network && <span className="deployment-error" id="network-error" role="alert">{errors.network}</span>}
        </div>}
        {step === 'Parameters' && <>
          <div className="deployment-field">
            <label htmlFor="deployment-name">Deployment name</label>
            <input id="deployment-name" value={name} required maxLength={80} autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : 'name-help'} onChange={(event) => { setName(event.target.value); setErrors({}) }} />
            {errors.name ? <span className="deployment-error" id="name-error" role="alert">{errors.name}</span> : <span className="deployment-state" id="name-help">A name to identify this simulated deployment.</span>}
          </div>
          <p className="deployment-state">No constructor parameters are required by these mock artifacts.</p>
        </>}
        {step === 'Review' && <>
          <p className="deployment-notice">Development simulation only. No blockchain transaction will be sent.</p>
          <dl className="deployment-summary"><dt>Deployment</dt><dd>{name.trim()}</dd><dt>Release</dt><dd>{release.name} · {release.commitSha}</dd><dt>Build run</dt><dd>#{run?.runNumber}</dd><dt>Artifact</dt><dd>{artifact?.contractName} · {artifact?.fileName}</dd><dt>Network</dt><dd>{network}</dd></dl>
        </>}
      </section>
      <div className="deployment-step-actions"><button type="button" className="deployment-secondary" onClick={() => { setErrors({}); setStep(steps[steps.indexOf(step) - 1]) }}>← Back</button><button className="deployment-primary">{step === 'Network' ? 'Continue to Parameters' : step === 'Parameters' ? 'Continue to Review' : 'Confirm simulation'} <span aria-hidden="true">→</span></button></div>
    </form>}
    {errors.artifact && <p role="alert" className="deployment-error">{errors.artifact}</p>}
    {review && <ConfirmationDialog request={review} release={release} artifact={artifact} submitting={submitting} error={submitError} onCancel={() => setReview(null)} onConfirm={() => { void submit() }} />}
  </>
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
