import type { PipelineRun, PipelineRunDetails, PipelineStage, PipelineStageError, StageKey } from '../types/pipelineRun'

const STAGE_NAMES: Record<StageKey, string> = {
  checkout: 'Checkout',
  build: 'Build',
  test: 'Test',
  slither: 'Slither',
  policy: 'Policy',
}

const STAGE_ORDER: StageKey[] = ['checkout', 'build', 'test', 'slither', 'policy']

/** Share of the total run duration spent in each stage. */
const STAGE_SHARE: Record<StageKey, number> = { checkout: 0.05, build: 0.3, test: 0.35, slither: 0.2, policy: 0.1 }

function successLogs(key: StageKey, run: PipelineRun): string[] {
  switch (key) {
    case 'checkout':
      return ['[INFO] Preparing workspace...', '[INFO] Cloning repository chainvault...', `[INFO] Fetching ${run.branch}...`, `[INFO] Checked out ${run.commitSha.slice(0, 7)} on ${run.branch}`]
    case 'build':
      return ['[INFO] Resolving toolchain: solc 0.8.24', '[INFO] Installing dependencies...', '[INFO] Compiling 8 contracts...', '[INFO] Compilation finished: 8 contracts, 0 warnings', '[INFO] Build artifacts saved']
    case 'test':
      return ['[INFO] Starting local Hardhat network...', '[INFO] Running 42 tests...', '[INFO] Vault: 24 passing', '[INFO] FeeManager: 18 passing', '[INFO] 42 passing (18s)']
    case 'slither':
      return ['[INFO] Running Slither static analysis...', '[INFO] Analyzing 8 contracts with 92 detectors', '[INFO] Analysis finished: 0 high, 1 medium, 3 low findings', '[INFO] Report uploaded to scan results']
    case 'policy':
      return ['[INFO] Evaluating release policy...', '[INFO] No high-severity findings', '[INFO] Required checks passed', '[INFO] Policy gate passed']
  }
}

const RUNNING_LOGS: Partial<Record<StageKey, string[]>> = {
  build: ['[INFO] Resolving toolchain: solc 0.8.24', '[INFO] Installing dependencies...', '[INFO] Compiling 8 contracts...', '[INFO] Waiting for compilation results...'],
}

interface FailureFixture {
  logs: string[]
  error: PipelineStageError
}

const FAILURES: Partial<Record<StageKey, FailureFixture>> = {
  build: {
    logs: ['[INFO] Resolving toolchain: solc 0.8.24', '[INFO] Installing dependencies...', '[INFO] Compiling 8 contracts...', '[ERROR] Compilation failed for contracts/FeeManager.sol'],
    error: {
      message: 'Solidity compilation failed',
      detail: 'contracts/FeeManager.sol:42:17: TypeError: Member "feeBps" not found in struct Vault.Config\n    uint256 fee = config.feeBps * amount / 10_000;\n                  ^-----------^',
    },
  },
  test: {
    logs: ['[INFO] Starting local Hardhat network...', '[INFO] Running 42 tests...', '[INFO] FeeManager: 18 passing', '[INFO] Vault: 22 passing', '[ERROR] Vault: 2 failing'],
    error: {
      message: '2 of 42 tests failed',
      detail: '1) Vault.withdraw reverts when amount exceeds balance\n   AssertionError: Expected transaction to be reverted with reason "InsufficientBalance"\n2) Vault.withdraw emits Withdrawn event\n   AssertionError: Expected event "Withdrawn" to be emitted',
    },
  },
}

interface RunFixture {
  contract?: PipelineRunDetails['contract']
  network?: string
  /** Stage the run stopped at; stages before it passed, stages after it never ran. */
  stoppedAt?: StageKey
}

const VAULT = { name: 'Vault', version: 'v1.4' }

const RUN_FIXTURES: Record<string, RunFixture> = {
  'run-129': { contract: VAULT, network: 'Sepolia', stoppedAt: 'build' },
  'run-128': { contract: VAULT, network: 'Sepolia' },
  'run-127': { contract: VAULT, network: 'Sepolia', stoppedAt: 'test' },
  'run-126': { contract: { name: 'FeeManager', version: 'v0.3' }, network: 'Sepolia' },
  'run-125': { contract: VAULT, network: 'Sepolia', stoppedAt: 'slither' },
  'run-124': { contract: VAULT, network: 'Sepolia' },
  'run-123': { contract: { name: 'Vault', version: 'v1.3' }, network: 'Sepolia' },
  'run-122': { contract: { name: 'FeeManager', version: 'v0.2' }, network: 'Sepolia', stoppedAt: 'build' },
  'run-121': { contract: { name: 'Vault', version: 'v1.3' } },
}

/** Builds deterministic stage fixtures from the run's overall status. */
export function buildRunDetails(run: PipelineRun): PipelineRunDetails {
  const fixture = RUN_FIXTURES[run.id] ?? {}
  const stopIndex = fixture.stoppedAt ? STAGE_ORDER.indexOf(fixture.stoppedAt) : STAGE_ORDER.length
  // Unfinished runs have no total yet; assume a typical 5-minute run for their completed stages.
  const total = run.durationSeconds ?? 300

  const stages = STAGE_ORDER.map((key, index): PipelineStage => {
    const name = STAGE_NAMES[key]
    const finishedDuration = Math.round(total * STAGE_SHARE[key])

    if (run.status === 'queued') return { key, name, status: 'pending', durationSeconds: null, logs: [] }
    if (index < stopIndex) return { key, name, status: 'success', durationSeconds: finishedDuration, logs: successLogs(key, run) }
    if (index > stopIndex) {
      const status = run.status === 'running' ? 'pending' : 'skipped'
      return { key, name, status, durationSeconds: null, logs: [] }
    }

    switch (run.status) {
      case 'running':
        return { key, name, status: 'running', durationSeconds: null, logs: RUNNING_LOGS[key] ?? [`[INFO] Running ${name.toLowerCase()} stage...`] }
      case 'failed': {
        const failure = FAILURES[key] ?? { logs: [`[ERROR] ${name} stage failed`], error: { message: `${name} stage failed` } }
        return { key, name, status: 'failed', durationSeconds: finishedDuration, logs: failure.logs, error: failure.error }
      }
      case 'cancelled':
        return {
          key,
          name,
          status: 'cancelled',
          durationSeconds: finishedDuration,
          logs: [`[INFO] Running ${name.toLowerCase()} stage...`, '[WARN] Run cancelled by user'],
        }
      default:
        return { key, name, status: 'success', durationSeconds: finishedDuration, logs: successLogs(key, run) }
    }
  })

  return { ...run, contract: fixture.contract, network: fixture.network, stages }
}
