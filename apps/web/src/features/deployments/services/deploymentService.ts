import { approvedReleases } from '../mocks/releases'
import { buildArtifacts } from '../mocks/artifacts'
import type { DeploymentService } from '../types/deployment'

/** Development fixture service. No blockchain or backend requests are made. */
export const mockDeploymentService: DeploymentService = {
  async getApprovedReleases(projectId) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return structuredClone(approvedReleases.filter((release) => release.projectId === projectId))
  },
  async getArtifacts(releaseId) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return structuredClone(buildArtifacts.filter((artifact) => artifact.releaseId === releaseId))
  },
  async simulateDeployment(request) {
    await new Promise((resolve) => setTimeout(resolve, 700))
    const release = approvedReleases.find((item) => item.id === request.releaseId && item.projectId === request.projectId)
    const artifact = buildArtifacts.find((item) => item.id === request.artifactId && item.releaseId === request.releaseId)
    if (!release || !artifact || !release.buildPassed || release.approvals < release.requiredApprovals || !release.allowedNetworks.includes(request.network) || !request.deploymentName.trim() || request.deploymentName.trim().length > 80) {
      throw new Error('Invalid deployment configuration')
    }
    return { simulationId: `simulation-${crypto.randomUUID()}`, deploymentName: request.deploymentName.trim(), network: request.network, simulated: true }
  },
}
