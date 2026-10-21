/// <reference types="node" />
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArtifactSelection } from './components/ArtifactSelection'
import { mockDeploymentService } from './services/deploymentService'

// Run through Vite's SSR build; see README.md. No additional test dependency.
const service = mockDeploymentService
const [release] = await service.getApprovedReleases('chainvault')
const [artifacts, runs] = await Promise.all([service.getArtifacts(release.id), service.getBuildRuns(release.id)])
assert.deepEqual(artifacts.map((artifact) => artifact.contractName), ['Vault', 'VaultFactory', 'MockUSDC'])
assert.equal(runs.filter((run) => run.eligible).length, 1)
assert.equal(runs.find((run) => run.eligible)?.runNumber, release.runNumber)

const props = { release, artifacts, runs, runId: runs[0].id, artifactId: artifacts[0].id, onRunChange() {}, onArtifactChange() {}, onBack() {}, onContinue() {} }
const markup = renderToStaticMarkup(<ArtifactSelection {...props} />)
assert.equal((markup.match(/type="radio"/g) ?? []).length, 6)
assert.equal((markup.match(/disabled=""/g) ?? []).length, 2)
assert.ok(markup.includes('VaultFactory.json'))
assert.ok(markup.includes('24.6 KB'))
assert.ok(!/<button[^>]*disabled/.test(markup))

for (const invalid of [
  { runId: runs[1].id },
  { runId: runs[2].id },
  { runId: '' },
  { artifactId: 'missing' },
  { artifacts: [] },
  { runs: [{ ...runs[0], commitSha: 'unapproved' }] },
]) {
  assert.ok(/<button[^>]*disabled/.test(renderToStaticMarkup(<ArtifactSelection {...props} {...invalid} />)))
}

for (const artifact of artifacts) {
  const result = await service.simulateDeployment({ projectId: release.projectId, releaseId: release.id, artifactId: artifact.id, network: 'Sepolia Testnet', deploymentName: `${artifact.contractName} preview` })
  assert.equal(result.simulated, true)
  assert.equal('transactionHash' in result, false)
}
await assert.rejects(service.simulateDeployment({ projectId: release.projectId, releaseId: release.id, artifactId: 'vault-124', network: 'Sepolia Testnet', deploymentName: 'Invalid cross-release artifact' }))
assert.deepEqual(await service.getBuildRuns('missing'), [])
assert.deepEqual(await service.getArtifacts('missing'), [])
console.log('Artifact checks passed: pinned-run eligibility, failed/unapproved run rejection, artifact choices, simulation, cross-release rejection, and empty states.')
