export interface ApprovedRelease {
  id: string
  projectId: string
  name: string
  commitSha: string
  runNumber: number
  buildPassed: boolean
  approvals: number
  requiredApprovals: number
  allowedNetworks: string[]
}

export interface DeploymentService {
  getApprovedReleases(projectId: string): Promise<ApprovedRelease[]>
  getArtifacts(releaseId: string): Promise<BuildArtifact[]>
  getBuildRuns(releaseId: string): Promise<DeploymentBuildRun[]>
  simulateDeployment(request: DeploymentRequest): Promise<DeploymentResult>
}

export interface BuildArtifact {
  id: string
  releaseId: string
  contractName: string
  source: string
  compiler: string
  fileName: string
  sizeKb: number
}

export interface DeploymentBuildRun {
  id: string
  runNumber: number
  commitSha: string
  branch: string
  title?: string
  status: 'passed' | 'failed'
  eligible: boolean
  ineligibleReason?: string
}

export interface DeploymentRequest {
  projectId: string
  releaseId: string
  artifactId: string
  network: string
  deploymentName: string
}

export interface DeploymentResult {
  simulationId: string
  deploymentName: string
  network: string
  simulated: true
}
