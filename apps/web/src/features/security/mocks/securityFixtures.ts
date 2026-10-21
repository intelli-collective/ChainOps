import type { SecurityFinding, SecurityScan } from '../types/security'

export const mockProjectId = 'chainvault'

// Illustrative design fixtures, not real Slither output or detector classifications.
const findings: SecurityFinding[] = [
  {
    id: 'SLT-001', title: 'Reentrancy vulnerability', contract: 'Vault.sol', severity: 'high', status: 'open',
    detectedAt: '2026-10-20T14:22:00+05:30', detector: 'Slither',
    description: 'Static analysis finding, not a verified exploit.',
    sourceLocation: { file: 'Vault.sol', line: 128 },
    sourceContext: {
      highlightedLine: 128,
      lines: [
        { number: 120, text: 'function withdraw(uint256 amount) external {' },
        { number: 121, text: '   require(amount > 0, "Amount must be greater than 0");' },
        { number: 122, text: '   uint256 balance = balances[msg.sender];' },
        { number: 123, text: '   require(balance >= amount, "Insufficient balance");' },
        { number: 124, text: '   // External call before state update' },
        { number: 125, text: '   (bool success, ) = msg.sender.call{value: amount}("");' },
        { number: 128, text: '   require(success, "Transfer failed");' },
        { number: 129, text: '   balances[msg.sender] -= amount;' },
        { number: 130, text: '   emit Withdrawn(msg.sender, amount);' },
        { number: 131, text: '}' },
      ],
    },
    explanation: 'An external call occurs before updating the user’s balance. Review whether re-entry could occur before the state update.',
    remediation: {
      summary: 'Update state before external calls and consider a reentrancy guard.',
      guidance: 'Update the withdrawal balance before transferring value. Consider a reentrancy guard and rerun analysis after the change.',
    },
    evidence: { summary: 'The value transfer in withdraw occurs before balances[msg.sender] is reduced.' },
  },
  { id: 'SLT-002', title: 'Untrusted external call', contract: 'Vault.sol', severity: 'medium', status: 'open', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-003', title: 'State variable could be const', contract: 'Vault.sol', severity: 'medium', status: 'acknowledged', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-004', title: 'Unused variable', contract: 'Token.sol', severity: 'low', status: 'open', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-005', title: 'Redundant condition', contract: 'Vault.sol', severity: 'low', status: 'resolved', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-006', title: 'Function visibility', contract: 'Token.sol', severity: 'low', status: 'open', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-007', title: 'Missing zero address check', contract: 'Vault.sol', severity: 'low', status: 'resolved', detectedAt: '2026-10-20T10:00:00Z' },
  { id: 'SLT-008', title: 'Potential arithmetic issue', contract: 'Vault.sol', severity: 'low', status: 'open', detectedAt: '2026-10-20T10:00:00Z' },
]

export function createSecurityFixtures(): SecurityScan[] {
  return structuredClone([
    { id: 'scan-130', number: 130, projectId: mockProjectId, pipelineRunId: '130', commitSha: 'b74a1d0', startedAt: '2026-10-20T10:00:00Z', status: 'completed', findings, policy: { decision: 'blocked', reason: 'Release policy allows no High findings; this scan contains one.' } },
    { id: 'scan-129', number: 129, projectId: mockProjectId, pipelineRunId: '129', commitSha: 'a62bf91', startedAt: '2026-10-19T09:00:00Z', status: 'completed', findings: [{ id: 'SLT-009', title: 'Compiler version information', contract: 'Token.sol', severity: 'informational', status: 'acknowledged', detectedAt: '2026-10-19T09:00:00Z' }], policy: { decision: 'passed', reason: 'This mock revision satisfies the release policy.' } },
    { id: 'scan-128', number: 128, projectId: mockProjectId, pipelineRunId: '128', commitSha: 'c1d578e', startedAt: '2026-10-18T08:00:00Z', status: 'completed', findings: [{ ...findings[1], detectedAt: '2026-10-18T08:00:00Z' }], policy: { decision: 'requires_review', reason: 'The mock policy requires review of the Medium finding.' } },
    { id: 'scan-127', number: 127, projectId: mockProjectId, pipelineRunId: '127', commitSha: 'd8af294', startedAt: '2026-10-17T08:00:00Z', status: 'failed', findings: [], policy: null, error: 'Mock analyzer could not compile this revision. No scan results are available.' },
  ] satisfies SecurityScan[])
}
