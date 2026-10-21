import type { ApprovedRelease } from '../types/deployment'

interface ReleaseSelectionProps {
  releases: ApprovedRelease[]
  releaseId: string
  network: string
  onSelect: (id: string) => void
  onContinue: () => void
  historyHref: string
}

export function ReleaseSelection({ releases, releaseId, network, onSelect, onContinue, historyHref }: ReleaseSelectionProps) {
  const release = releases.find((item) => item.id === releaseId)
  const checks = release ? [
    { passed: release.buildPassed, text: release.buildPassed ? 'Build and tests passed' : 'Build and tests have not passed' },
    { passed: release.approvals >= release.requiredApprovals, text: `${release.approvals} of ${release.requiredApprovals} reviewer approvals` },
    { passed: release.allowedNetworks.includes(network), text: `${network} ${release.allowedNetworks.includes(network) ? 'allowed' : 'not allowed'}` },
  ] : []

  return (
    <section className="deployment-panel" aria-labelledby="release-heading">
      <h2 id="release-heading">Select approved release</h2>
      <form onSubmit={(event) => { event.preventDefault(); onContinue() }}>
        <div className="deployment-field">
          <label htmlFor="deployment-release">Release</label>
          <select id="deployment-release" value={releaseId} onChange={(event) => onSelect(event.target.value)} required>
            <option value="" disabled>Select an approved release</option>
            {releases.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.commitSha} · Run #{item.runNumber}</option>)}
          </select>
        </div>
        <ul className="deployment-checks" aria-live="polite">
          {checks.map((check) => <li key={check.text} className={check.passed ? '' : 'deployment-error'}><span aria-hidden="true">{check.passed ? '✓' : '×'}</span> {check.text}</li>)}
        </ul>
        <button className="deployment-primary" disabled={!release || checks.some((check) => !check.passed)}>Continue to Artifact <span aria-hidden="true">→</span></button>
      </form>
      <a className="deployment-history" href={historyHref}>Return to deployment history</a>
    </section>
  )
}
