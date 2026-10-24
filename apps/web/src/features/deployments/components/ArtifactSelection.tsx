import { useEffect, useRef, useState } from 'react'
import type { ApprovedRelease, BuildArtifact, DeploymentBuildRun } from '../types/deployment'

interface Props {
  release: ApprovedRelease
  runs: DeploymentBuildRun[]
  artifacts: BuildArtifact[]
  runId: string
  artifactId: string
  onRunChange: (id: string) => void
  onArtifactChange: (id: string) => void
  onBack: () => void
  onContinue: () => void
}

export function ArtifactSelection({ release, runs, artifacts, runId, artifactId, onRunChange, onArtifactChange, onBack, onContinue }: Props) {
  const [details, setDetails] = useState<'runs' | 'artifacts' | BuildArtifact | null>(null)
  const selectedRun = runs.find((run) => run.id === runId)
  const canContinue = selectedRun?.eligible && selectedRun.status === 'passed' && selectedRun.runNumber === release.runNumber && selectedRun.commitSha === release.commitSha && artifacts.some((artifact) => artifact.id === artifactId && artifact.releaseId === release.id)

  return <>
    <section className="deployment-choice-panel" aria-labelledby="build-run-heading">
      <div className="deployment-section-header"><h2 id="build-run-heading">1. Select a build run</h2><button className="deployment-text-button" onClick={() => setDetails('runs')}>View all runs <span aria-hidden="true">→</span></button></div>
      <p className="deployment-state deployment-run-help" id="run-help">Only successful, eligible runs can be deployed.</p>
      {!runs.length && <p role="status" className="deployment-state">No build runs are available for this release.</p>}
      <div role="radiogroup" aria-labelledby="build-run-heading" aria-describedby="run-help">
        {runs.map((run) => <label key={run.id} className="deployment-run-row" title={run.ineligibleReason}>
          <span className="deployment-radio-label"><input type="radio" name="build-run" value={run.id} checked={runId === run.id} disabled={!run.eligible || run.status !== 'passed' || run.runNumber !== release.runNumber || run.commitSha !== release.commitSha} onChange={() => onRunChange(run.id)} /><span>#{run.runNumber} · {run.commitSha} · {run.branch}{run.title ? ` · ${run.title}` : ''}</span></span>
          <span className={run.status === 'passed' ? 'deployment-passed' : 'deployment-error'}><span aria-hidden="true">{run.status === 'passed' ? '✓' : '×'}</span> {run.status === 'passed' ? 'Passed' : 'Failed'}</span>
          {run.ineligibleReason && <span className="deployment-sr-only">{run.ineligibleReason}</span>}
        </label>)}
      </div>
    </section>
    <section className="deployment-choice-panel" aria-labelledby="contract-artifact-heading">
      <div className="deployment-section-header"><h2 id="contract-artifact-heading">2. Select contract artifact</h2><button className="deployment-text-button" onClick={() => setDetails('artifacts')}>View build artifacts <span aria-hidden="true">→</span></button></div>
      {!artifacts.length && <p className="deployment-state" role="status">No build artifacts are available for this release. Choose another release.</p>}
      <div role="radiogroup" aria-labelledby="contract-artifact-heading">
        {artifacts.map((artifact) => <div className="deployment-artifact-row" key={artifact.id}>
          <label className="deployment-radio-label"><input type="radio" name="contract-artifact" value={artifact.id} checked={artifactId === artifact.id} onChange={() => onArtifactChange(artifact.id)} /><span>{artifact.contractName}</span></label>
          <button className="deployment-text-button" onClick={() => setDetails(artifact)} aria-label={`View ${artifact.fileName} details`}>{artifact.fileName}</button>
          <span className="deployment-state">{artifact.sizeKb.toFixed(1)} KB</span>
        </div>)}
      </div>
    </section>
    <div className="deployment-step-actions"><button className="deployment-secondary" onClick={onBack}>← Back</button><button className="deployment-primary" disabled={!canContinue} onClick={onContinue}>Continue to Network <span aria-hidden="true">→</span></button></div>
    {details && <ArtifactDetailsDialog title={details === 'runs' ? 'Build runs' : details === 'artifacts' ? 'Build artifacts' : details.fileName} onClose={() => setDetails(null)}>
      <p className="deployment-notice">Mock build data · {release.name} · Run #{release.runNumber}</p>
      {details === 'runs' ? runs.map((run) => <div className="deployment-detail-entry" key={run.id}><p>#{run.runNumber} · {run.commitSha} · {run.branch}</p><p className="deployment-state">{run.status === 'passed' ? 'Passed' : 'Failed'} · {run.eligible ? 'Eligible for this release' : run.ineligibleReason}</p></div>) : (details === 'artifacts' ? artifacts : [details]).map((artifact) => <dl key={artifact.id} className="deployment-summary"><dt>Contract</dt><dd>{artifact.contractName}</dd><dt>File</dt><dd>{artifact.fileName}</dd><dt>Source</dt><dd>{artifact.source}</dd><dt>Compiler</dt><dd>{artifact.compiler}</dd><dt>Size</dt><dd>{artifact.sizeKb.toFixed(1)} KB</dd></dl>)}
    </ArtifactDetailsDialog>}
  </>
}

function ArtifactDetailsDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="deployment-dialog" aria-labelledby="artifact-details-title" onCancel={(event) => { event.preventDefault(); onClose() }}><h2 id="artifact-details-title">{title}</h2>{children}<button className="deployment-secondary" autoFocus onClick={onClose}>Close</button></dialog>
}
