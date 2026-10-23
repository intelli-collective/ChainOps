import { useResource } from '../member2Hooks'
import type { Member2Scope as Scope } from '../types/member2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  DeploymentArtifact,
  DeploymentDraft,
  DeploymentNetwork,
  PreflightResult
} from '../types/member2'
import { validateParameters } from '../parameterValidation'
import { shorten } from '../member2Utils'
import {
  AbiViewer,
  PageHeading,
  Panel,
  PinnedContext,
  ResourceState
} from '../components/Member2Ui'

const stageLabels = [
  ['Choose artifact', 'Artifact selected'],
  ['Environment', 'Environment set'],
  ['Parameters', 'Parameters valid'],
  ['Review', 'Review']
]
function Steps({ step }: { step: number }) {
  return (
    <ol className="m2-steps" aria-label="Deployment progress">
      {stageLabels.map(([label, done], i) => (
        <li
          key={label}
          aria-current={i === step ? 'step' : undefined}
          className={i <= step ? 'm2-step-active' : ''}
        >
          <span>{i < step ? '✓' : i === step ? '◉' : '○'}</span>
          {i < step ? done : label}
        </li>
      ))}
    </ol>
  )
}

export function DeploymentWizard({ projectId, service, root }: Scope) {
  const state = useResource(
    useCallback(async () => {
      const [artifacts, networks] = await Promise.all([
        service.artifacts(projectId),
        service.networks(projectId)
      ])
      return { artifacts, networks }
    }, [projectId, service])
  )
  return (
    <>
      {!state.value && (
        <>
          <PageHeading
            title="Deploy Contract"
            subtitle="Deploy a compiled contract from an approved pipeline run to a network."
            crumb="Deployments › New deployment"
            back={`${root}/deployments`}
          />
          <ResourceState {...state} />
        </>
      )}
      {state.value && (
        <WizardFlow
          {...{ projectId, service, root }}
          artifacts={state.value.artifacts}
          networks={state.value.networks}
        />
      )}
    </>
  )
}
function WizardFlow({
  projectId,
  service,
  root,
  artifacts,
  networks
}: Scope & { artifacts: DeploymentArtifact[]; networks: DeploymentNetwork[] }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0),
    [artifactId, setArtifactId] = useState(artifacts[0]?.id ?? ''),
    [networkId, setNetworkId] = useState(
      networks.find((n) => n.id === 'sepolia')?.id ?? networks[0]?.id ?? ''
    )
  const [values, setValues] = useState<string[]>([]),
    [errors, setErrors] = useState<Record<number, string>>({}),
    [checked, setChecked] = useState(false)
  const [preflight, setPreflight] = useState<PreflightResult>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [blockedDemo, setBlockedDemo] = useState(false)
  const lock = useRef(false),
    key = useRef(crypto.randomUUID()),
    heading = useRef<HTMLDivElement>(null),
    previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus()
    previousStep.current = step
  }, [step])
  const artifact = artifacts.find((a) => a.id === artifactId),
    network = networks.find((n) => n.id === networkId)
  const constructor = artifact?.abi.find((a) => a.type === 'constructor'),
    inputs = constructor?.inputs ?? []
  const draft: DeploymentDraft = {
    artifactId,
    networkId,
    parameters: inputs.map((_, i) => values[i] ?? '')
  }
  async function check() {
    if (lock.current) return
    const invalid = validateParameters(inputs, draft.parameters)
    setErrors(invalid)
    setChecked(true)
    if (Object.keys(invalid).length) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      setPreflight(await service.preflight(projectId, draft))
      setStep(3)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Preflight could not be completed.'
      )
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  async function submit() {
    if (lock.current || !preflight?.eligible || blockedDemo) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const row = await service.submit(projectId, draft, key.current)
      navigate(`${root}/deployments/${row.id}`)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Submission could not be confirmed. Reconcile deployment history before retrying.'
      )
      setStep(3)
      setPreflight(undefined)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  const subtitles = [
    'Deploy a compiled contract from an approved pipeline run to a network.',
    'Configure the target network and deployment account.',
    `Configure constructor parameters for ${artifact?.name ?? 'the contract'}.`,
    'Review all details before deploying to the selected network.',
    'Review the signing request before submitting.'
  ]
  function back() {
    setError('')
    setBlockedDemo(false)
    if (step === 0) navigate(`${root}/deployments`)
    else setStep(Math.min(step - 1, 3))
  }
  const changeArtifact = (id: string) => {
    setArtifactId(id)
    setValues([])
    setErrors({})
    setChecked(false)
    setPreflight(undefined)
    key.current = crypto.randomUUID()
  }
  return (
    <>
      <div ref={heading} tabIndex={-1}>
        <PageHeading
          title={step === 4 ? 'Confirm deployment' : 'Deploy Contract'}
          subtitle={subtitles[step]}
          crumb="Deployments › New deployment"
          back={`${root}/deployments`}
        />
      </div>
      <Steps step={Math.min(step, 3)} />
      {artifact && (
        <PinnedContext artifact={artifact} network={network?.name} />
      )}
      {!artifact ? (
        <Panel title="No approved artifacts">
          <p className="m2-muted">
            No validated, approved artifact is available for this project.
            Publish build artifacts and approval evidence before deploying.
          </p>
          <Link to={`${root}/pipelines`}>View build runs →</Link>
        </Panel>
      ) : (
        <>
          {step === 0 && (
            <>
              <Panel title="1. Select a build run">
                <Link className="m2-panel-action" to={`${root}/pipelines`}>
                  View all runs →
                </Link>
                <p className="m2-muted">
                  Only successful, eligible runs can be deployed.
                </p>
                {[
                  ...new Map(
                    artifacts.map((a) => [a.pipelineRunId, a])
                  ).values()
                ].map((a) => (
                  <label className="m2-run" key={a.pipelineRunId}>
                    <span>
                      <input
                        type="radio"
                        name="run"
                        checked={artifact.pipelineRunId === a.pipelineRunId}
                        onChange={() => changeArtifact(a.id)}
                      />{' '}
                      #{a.runNumber} · {a.commitSha} · {a.branch} · {a.title}
                    </span>
                    <span className="m2-success">✓ Passed</span>
                  </label>
                ))}
                {service.preview && (
                  <>
                    <div className="m2-run">
                      <label title="Failed runs cannot be deployed">
                        <input type="radio" name="run" disabled /> #127 ·
                        98bd4f1 · main · Fix tests
                      </label>
                      <span className="m2-error">× Failed</span>
                    </div>
                    <div className="m2-run">
                      <label title="This run has no approved release evidence">
                        <input type="radio" name="run" disabled /> #126 ·
                        e7c1d0a · feature/fees
                      </label>
                      <span className="m2-success">✓ Passed</span>
                    </div>
                  </>
                )}
              </Panel>
              <Panel title="2. Select contract artifact">
                <Link
                  className="m2-panel-action"
                  to={`${root}/artifacts/${artifact.id}/abi`}
                >
                  View build artifacts →
                </Link>
                {artifacts
                  .filter((a) => a.pipelineRunId === artifact.pipelineRunId)
                  .map((a) => (
                    <div className="m2-artifact" key={a.id}>
                      <label>
                        <input
                          type="radio"
                          name="artifact"
                          checked={artifactId === a.id}
                          onChange={() => changeArtifact(a.id)}
                        />{' '}
                        {a.name}
                      </label>
                      <Link to={`${root}/artifacts/${a.id}/abi`}>
                        {a.fileName}
                      </Link>
                      <span className="m2-muted">{a.sizeKb.toFixed(1)} KB</span>
                    </div>
                  ))}
              </Panel>
            </>
          )}
          {step === 1 && (
            <>
              <div className="m2-columns m2-network-columns">
                <Panel title="1. Select target network">
                  <div className="m2-network-options">
                    {networks.map((n) => (
                      <section className="m2-network-card" key={n.id}>
                        <h3
                          className={networkId === n.id ? 'm2-link-color' : ''}
                        >
                          {networkId === n.id ? '◉' : '○'} {n.name}
                        </h3>
                        <p>
                          Chain ID: {n.chainId}
                          <br />
                          RPC: {n.rpcLabel}
                        </p>
                        <button
                          className={
                            networkId === n.id ? 'm2-primary' : 'm2-secondary'
                          }
                          onClick={() => {
                            setNetworkId(n.id)
                            setPreflight(undefined)
                            key.current = crypto.randomUUID()
                          }}
                        >
                          {networkId === n.id ? 'Selected' : 'Select network'}
                        </button>
                      </section>
                    ))}
                  </div>
                  {!networks.length && (
                    <p role="status">No project environments are configured.</p>
                  )}
                </Panel>
                <Panel title="Network details">
                  {network ? (
                    <div className="m2-detail-lines">
                      <p>{network.name}</p>
                      <p>Chain ID: {network.chainId}</p>
                      <p
                        className={
                          network.connected ? 'm2-link-color' : 'm2-error'
                        }
                      >
                        {network.connected
                          ? `● Connected${network.latencyMs ? ` (${network.latencyMs} ms)` : ''}`
                          : '○ RPC unavailable'}
                      </p>
                      <p>Environment: {network.environment}</p>
                      <p>
                        Latest block:{' '}
                        {network.latestBlock?.toLocaleString() ?? 'Unavailable'}
                      </p>
                    </div>
                  ) : (
                    <p>Select a configured network.</p>
                  )}
                </Panel>
              </div>
              <Panel title="2. Deployment account" className="m2-account-panel">
                <p
                  className={
                    network?.signingAvailable ? 'm2-success' : 'm2-warning'
                  }
                >
                  {network?.signingAvailable
                    ? 'Connected wallet  ·  Authorized deployer'
                    : 'Signing account is not configured'}
                </p>
                <p className="m2-wrap">
                  {network?.account ?? 'No deployment account available'}
                </p>
                <p className="m2-muted">
                  Balance:{' '}
                  {network?.balance ? `${network.balance} ETH` : 'Unavailable'}
                </p>
              </Panel>
            </>
          )}
          {step === 2 && (
            <>
              <div className="m2-columns">
                <Panel
                  title="Constructor parameters"
                  className="m2-parameters-panel"
                >
                  {!inputs.length && (
                    <p>This artifact has no constructor parameters.</p>
                  )}
                  {inputs.map((input, i) => (
                    <div className="m2-field" key={`${input.name}-${i}`}>
                      <label htmlFor={`param-${i}`}>
                        {input.name || `Parameter ${i + 1}`} ({input.type}) ·
                        Required
                      </label>
                      <input
                        id={`param-${i}`}
                        value={values[i] ?? ''}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={Boolean(errors[i])}
                        aria-describedby={
                          checked ? `param-feedback-${i}` : undefined
                        }
                        onChange={(e) => {
                          const next = [...values]
                          next[i] = e.target.value
                          setValues(next)
                          setChecked(false)
                          setErrors({})
                          setPreflight(undefined)
                          key.current = crypto.randomUUID()
                        }}
                      />
                      {checked && (
                        <span
                          id={`param-feedback-${i}`}
                          className={errors[i] ? 'm2-error' : 'm2-link-color'}
                        >
                          {errors[i] ??
                            `✓ Valid ${input.type === 'address' ? 'Ethereum address' : input.type}`}
                        </span>
                      )}
                    </div>
                  ))}
                  <button
                    className="m2-text-button m2-muted"
                    onClick={() => {
                      setErrors(validateParameters(inputs, draft.parameters))
                      setChecked(true)
                    }}
                  >
                    Validate parameters
                  </button>
                  {service.preview && Object.keys(errors).length > 0 && (
                    <button
                      className="m2-text-button"
                      onClick={() => {
                        setValues(
                          inputs.map((i) =>
                            i.type === 'address'
                              ? (network?.account ?? '')
                              : '0'
                          )
                        )
                        setErrors({})
                        setChecked(true)
                      }}
                    >
                      Use valid sample values
                    </button>
                  )}
                </Panel>
                <Panel title="Contract ABI (constructor)">
                  <AbiViewer
                    abi={constructor ?? { type: 'constructor', inputs: [] }}
                  />
                </Panel>
              </div>
              <Panel title="Deployment summary (so far)">
                <span className="m2-link-color">
                  {artifact.name} · {artifact.fileName} | Artifact digest{' '}
                  {shorten(artifact.digest)} | {network?.name}
                </span>
              </Panel>
            </>
          )}
          {step === 3 && (
            <>
              <div className="m2-columns m2-review-columns">
                <Panel title="Deployment details">
                  <dl className="m2-stacked-details">
                    <dt>Commit & build</dt>
                    <dd>
                      <Link to={`${root}/pipelines/${artifact.pipelineRunId}`}>
                        {artifact.commitSha} · Run #{artifact.runNumber} ·
                        Passed
                      </Link>
                    </dd>
                    <dt>Contract artifact</dt>
                    <dd>
                      <Link to={`${root}/artifacts/${artifact.id}/abi`}>
                        {artifact.name} ({artifact.fileName}) · Digest{' '}
                        {shorten(artifact.digest)}
                      </Link>
                    </dd>
                    <dt>Target network</dt>
                    <dd>
                      {network?.name} · Chain ID {network?.chainId}
                    </dd>
                    <dt>Deployer account</dt>
                    <dd>
                      {preflight?.account ?? network?.account ?? 'Unavailable'}
                    </dd>
                    <dt>Constructor parameters</dt>
                    <dd>
                      {inputs
                        .map((i, n) => `${i.name}: ${values[n]}`)
                        .join(' · ') || 'None'}
                    </dd>
                    <dt>Estimated gas</dt>
                    <dd>
                      {preflight?.estimatedGas
                        ? `${Number(preflight.estimatedGas).toLocaleString()} gas`
                        : 'Unavailable'}
                    </dd>
                    <dt>Post-deployment</dt>
                    <dd>Add confirmed contract to project contracts</dd>
                  </dl>
                </Panel>
                <Panel title="Security & policy checks">
                  <div className="m2-checks">
                    {preflight?.checks.map((c) => (
                      <p
                        key={c.label}
                        className={c.passed ? 'm2-link-color' : 'm2-error'}
                      >
                        {c.passed ? '✓' : '×'} {c.label}
                      </p>
                    ))}
                    {!preflight && (
                      <p className="m2-warning">
                        Run preflight again before signing.
                      </p>
                    )}
                    {blockedDemo && (
                      <p className="m2-error">
                        × Required reviewer approval missing
                      </p>
                    )}
                  </div>
                  <p className="m2-cost">
                    Estimated total cost
                    <br />
                    {preflight?.estimatedCost
                      ? `~${preflight.estimatedCost} ETH`
                      : 'Unavailable'}
                  </p>
                  <p className="m2-muted">
                    Final gas cost may vary with network conditions.
                  </p>
                </Panel>
              </div>
              {(blockedDemo || preflight?.eligible === false) && (
                <p role="alert" className="m2-error">
                  Deployment blocked:{' '}
                  {blockedDemo
                    ? 'obtain the required approval before signing.'
                    : preflight?.reason}
                </p>
              )}
            </>
          )}
          {step === 4 && (
            <Panel className="m2-signing">
              <h2 className="m2-large-heading">Deployment signing request</h2>
              <div className="m2-signing-details">
                Contract: {artifact.name}
                <br />
                Network: {network?.name}
                <br />
                Account: {preflight?.account ?? network?.account}
                <br />
                Constructor:{' '}
                {inputs.map((i) => `${i.name} (${i.type})`).join(', ') ||
                  'None'}
                <br />
                Estimated gas:{' '}
                {Number(preflight?.estimatedGas ?? 0).toLocaleString()}
              </div>
              <p className="m2-muted">
                Confirm the selected account, network and deployment parameters.
              </p>
              <div className="m2-actions">
                <button className="m2-secondary" disabled={busy} onClick={back}>
                  Cancel
                </button>
                <button
                  className="m2-primary"
                  disabled={busy}
                  onClick={() => {
                    void submit()
                  }}
                >
                  {busy
                    ? 'Submitting…'
                    : service.preview
                      ? 'Sign & submit (demo)'
                      : 'Sign & submit'}
                </button>
              </div>
            </Panel>
          )}
          {error && (
            <p role="alert" className="m2-error">
              {error}
            </p>
          )}
          {step < 4 && (
            <div className="m2-wizard-actions">
              <button className="m2-secondary" disabled={busy} onClick={back}>
                ← Back
              </button>
              <button
                className="m2-primary"
                disabled={
                  busy ||
                  (step === 1 && !network) ||
                  (step === 3 && (blockedDemo || preflight?.eligible === false))
                }
                onClick={() => {
                  if (step === 2 || (step === 3 && !preflight)) void check()
                  else if (step === 0) {
                    setStep(1)
                  } else if (step === 1) {
                    setValues((current) =>
                      current.length === inputs.length
                        ? current
                        : inputs.map((i) =>
                            i.type === 'address' ? (network?.account ?? '') : ''
                          )
                    )
                    setStep(2)
                  } else setStep(4)
                }}
              >
                {busy
                  ? 'Checking preflight…'
                  : step === 0
                    ? 'Continue to Network →'
                    : step === 1
                      ? 'Continue to Parameters →'
                      : step === 2
                        ? 'Continue to Review →'
                        : !preflight
                          ? 'Run preflight checks →'
                          : 'Confirm deployment →'}
              </button>
            </div>
          )}
          {step === 3 && service.preview && (
            <button
              className="m2-text-button m2-muted"
              onClick={() => setBlockedDemo(!blockedDemo)}
            >
              {blockedDemo
                ? 'Return to deployment review'
                : 'Review a blocked preflight'}
            </button>
          )}
        </>
      )}
    </>
  )
}
