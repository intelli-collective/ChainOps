import type { DeploymentBuildRun } from '../types/deployment'

export const recentBuildRuns: DeploymentBuildRun[] = [
  { id: 'run-128', runNumber: 128, commitSha: 'a3f9c2e', branch: 'main', title: 'Prepare Vault v1.4', status: 'passed', eligible: true },
  { id: 'run-127', runNumber: 127, commitSha: '98bd4f1', branch: 'main', title: 'Fix tests', status: 'failed', eligible: false, ineligibleReason: 'Build and tests did not pass.' },
  { id: 'run-126', runNumber: 126, commitSha: 'e7c1d0a', branch: 'feature/fees', status: 'passed', eligible: false, ineligibleReason: 'This run is not part of the pinned approved release.' },
]
