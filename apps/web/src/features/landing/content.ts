import type { LandingIconName } from './LandingIcon'

export const workflowSteps: { title: string; description: string; icon: LandingIconName }[] = [
  { title: 'Develop', description: 'Push code to GitHub repository', icon: 'github' },
  { title: 'Validate', description: 'Compile, test and run security analysis', icon: 'cube' },
  { title: 'Govern', description: 'Apply policies and require approvals', icon: 'shield' },
  { title: 'Deploy', description: 'Deploy to EVM networks', icon: 'document' },
  { title: 'Monitor', description: 'Track events and contract activity', icon: 'chart' },
  { title: 'Operate', description: 'Get alerts and maintain audit history', icon: 'bell' },
]

export const capabilities: { title: string; description: string; detail: string; icon: LandingIconName }[] = [
  { title: 'CI/CD Pipelines', description: 'Automate build, test and security analysis for every source revision.', detail: 'Connect a repository and follow each revision through checkout, compilation, tests and security checks. Pipeline run records keep the commit and its validation results together.', icon: 'branch' },
  { title: 'Security Validation', description: 'Integrate established analyzers such as Slither and apply custom policies.', detail: 'Review security findings by severity and inspect their source locations. Policy decisions stay separate from scan findings, so teams can understand why a release needs review.', icon: 'shield' },
  { title: 'Governed Deployment', description: 'Controlled deployment with approval workflows and transaction tracking.', detail: 'Prepare a deployment from an approved release, choose its build artifact and target network, and review the configuration before submission. The current frontend demonstrates this with a labelled simulation.', icon: 'rocket' },
  { title: 'Contract Registry', description: 'Maintain deployed addresses, versions, artifacts and full history.', detail: 'Find a contract by name, address or version, filter by network, and inspect its linked release and deployment transaction. The current registry preview uses typed mock records.', icon: 'database' },
  { title: 'Monitoring & Alerts', description: 'Observe contract events and relevant transaction activity in real time.', detail: 'Keep contract activity, decoded events and alert summaries in view. Live network monitoring and alert delivery are planned integrations; current dashboard data is simulated.', icon: 'chart' },
  { title: 'Audit Trail', description: 'Complete traceability from commit to on-chain operations.', detail: 'Keep the source revision, pipeline checks, approval decision, artifact and deployment metadata connected. This provides a clear path for reviewing how a release reached a network.', icon: 'document' },
]

export const benefits: { title: string; description: string; icon: LandingIconName }[] = [
  { title: 'Increase confidence in deployments', description: 'Validated, policy-compliant releases with full traceability.', icon: 'bolt' },
  { title: 'Improve team collaboration', description: 'Clear approval workflows and audit history.', icon: 'users' },
  { title: 'Stay informed in production', description: 'Real-time monitoring and configurable alerts.', icon: 'cube' },
]

export const integrations: { name: string; icon: LandingIconName; className?: string }[] = [
  { name: 'GitHub', icon: 'github' },
  { name: 'Hardhat', icon: 'helmet', className: 'landing-partner-yellow' },
  { name: 'Foundry', icon: 'foundry', className: 'landing-partner-blue' },
  { name: 'Slither', icon: 'slither', className: 'landing-partner-teal' },
  { name: 'Ethereum', icon: 'ethereum' },
  { name: 'Other EVM Networks', icon: 'network' },
]
