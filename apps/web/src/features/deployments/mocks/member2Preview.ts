import type {
  DeploymentArtifact,
  DeploymentRecord,
  Member2Service,
  RegisteredContract,
  TransactionStatus
} from '../types/member2'

export const previewNetworks = [
  {
    id: 'hardhat',
    name: 'Local Hardhat',
    chainId: 31337,
    environment: 'Local development',
    rpcLabel: 'http://127.0.0.1:8545',
    connected: true,
    signingAvailable: true,
    latestBlock: 123,
    latencyMs: 2,
    account: '0x4cD0534C4938247Fa8e1D2c730986f4A9cE2D1F0',
    balance: '10000'
  },
  {
    id: 'sepolia',
    name: 'Sepolia Testnet',
    chainId: 11155111,
    environment: 'Public testnet',
    rpcLabel: 'Configured RPC (credentials hidden)',
    explorerUrl: 'https://sepolia.etherscan.io',
    connected: true,
    signingAvailable: true,
    latestBlock: 7842311,
    latencyMs: 24,
    account: '0x4cD0534C4938247Fa8e1D2c730986f4A9cE2D1F0',
    balance: '2.4837'
  }
]
export const previewArtifacts: DeploymentArtifact[] = [
  'Vault',
  'VaultFactory',
  'MockUSDC'
].map((name, i) => ({
  id: `artifact-${name.toLowerCase()}`,
  projectId: 'chainvault',
  name,
  version: 'v1.4',
  fileName: `${name}.json`,
  sizeKb: [24.6, 12.1, 9.8][i],
  commitSha: 'a3f9c2e',
  pipelineRunId: 'run-128',
  runNumber: 128,
  branch: 'main',
  title: 'Prepare Vault v1.4',
  digest: `0x8a847fe9c1d3b6e77${'0'.repeat(47)}`,
  source: `contracts/${name}.sol`,
  compiler: '0.8.26',
  metadata: {
    optimizerRuns: 200,
    evm: 'Paris',
    uri: 'ipfs://bafy…7e3c',
    license: 'MIT',
    contractType: 'Upgradeable (UUPS)'
  },
  approvalId: 'approval-128',
  policyResultId: 'policy-128',
  approvals: 2,
  requiredApprovals: 2,
  abi: [
    {
      type: 'constructor',
      inputs: [{ name: 'owner', type: 'address' }],
      stateMutability: 'nonpayable'
    },
    {
      type: 'function',
      name: 'deposit',
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable'
    },
    {
      type: 'function',
      name: 'owner',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view'
    }
  ]
}))
const statuses: TransactionStatus[] = [
  'CONFIRMED',
  'PENDING',
  'REVERTED',
  'UNKNOWN',
  'CONFIRMED'
]
function initialDeployments(): DeploymentRecord[] {
  return statuses.map((status, i) => ({
    id: `deployment-${i + 1}`,
    projectId: 'chainvault',
    artifact: { ...previewArtifacts[0], version: `v1.${4 - i}` },
    network: previewNetworks[1],
    parameters: [previewNetworks[1].account],
    status,
    targetContracts: [
      ['Vault', 'TokenFactory'],
      ['Vault'],
      ['TokenFactory'],
      ['Treasury'],
      ['Vault', 'Treasury']
    ][i],
    requestedBy: [
      'Daniel Smith',
      'Taylor Kim',
      'Morgan Lee',
      'Jamie Park',
      'Daniel Smith'
    ][i],
    submittedAt: `2026-10-${String(14 - i * 2).padStart(2, '0')}T14:41:06Z`,
    transactionHash: `0x${['8f3a', '2b6f', '6d2c', 'a1e9', '7c11'][i]}${'0'.repeat(56)}${['d921', '7ac4', '9f10', '3b77', 'e552'][i]}`,
    confirmations: status === 'CONFIRMED' ? 3482 : 0,
    requiredConfirmations: 3,
    ...(status === 'CONFIRMED'
      ? {
          contractId: 'contract-vault',
          contractAddress: `0x3f2a${'0'.repeat(32)}9c1d`,
          blockNumber: 7834231,
          minedAt: '2026-10-14T14:41:23Z',
          gasUsed: '1842311',
          gasPrice: '20.1',
          transactionFee: '0.037018',
          receipt: { status: '0x1', blockNumber: 7834231, gasUsed: 1842311 },
          logs: []
        }
      : {}),
    ...(status === 'REVERTED'
      ? {
          reason:
            'The submitted transaction reverted. No successful contract registry entry was created.'
        }
      : {})
  }))
}
function initialContracts(): RegisteredContract[] {
  return ['Vault', 'TokenFactory', 'Treasury', 'Escrow'].map((name, i) => ({
    id: `contract-${name.toLowerCase()}`,
    projectId: 'chainvault',
    name,
    version: i === 3 ? 'v1.0' : 'v1.4',
    address: `0x${['3f2a', '7b6e', '8d11', '8a72'][i]}${'0'.repeat(32)}${['9c1d', '2d44', '6f02', '4b19'][i]}`,
    network: previewNetworks[1],
    provenance: i === 3 ? 'external' : 'deployment',
    status: i === 3 ? 'Registered' : 'Active',
    monitoring: i === 3 ? 'Not enabled' : i === 2 ? 'Degraded' : 'Healthy',
    createdAt: '2026-10-14T16:21:00Z',
    ...(i === 3
      ? {}
      : {
          artifact: {
            ...previewArtifacts[0],
            name,
            source: `contracts/${name}.sol`
          },
          recentEvents:
            i === 0
              ? [
                  {
                    timestamp: '2026-10-26T11:42:00Z',
                    name: 'Deposit',
                    summary: 'amount: 1,250 USDC'
                  },
                  {
                    timestamp: '2026-10-26T10:17:00Z',
                    name: 'Withdraw',
                    summary: 'amount: 500 USDC'
                  },
                  {
                    timestamp: '2026-10-26T08:03:00Z',
                    name: 'RoleGranted',
                    summary: 'role: OPERATOR'
                  }
                ]
              : [],
          deploymentId: 'deployment-1',
          transactionHash: initialDeployments()[0].transactionHash
        })
  }))
}
/** Only imported by the explicit Vite development preview route. Never sends RPC requests. */
export function createMember2Preview(): Member2Service {
  let deployments = initialDeployments(),
    contracts = initialContracts()
  const submissions = new Map<string, DeploymentRecord>()
  const pending = new Set<string>()
  try {
    const saved = JSON.parse(
      sessionStorage.getItem('chainops-m2-preview-v1') ?? 'null'
    ) as {
      deployments: DeploymentRecord[]
      contracts: RegisteredContract[]
    } | null
    if (saved?.deployments && saved?.contracts) {
      deployments = saved.deployments
      contracts = saved.contracts
    }
  } catch {
    /* Storage is optional for a preview. */
  }
  deployments
    .filter((d) => d.status === 'PENDING' && !d.id.startsWith('deployment-'))
    .forEach((d) => pending.add(d.id))
  function save() {
    try {
      sessionStorage.setItem(
        'chainops-m2-preview-v1',
        JSON.stringify({ deployments, contracts })
      )
    } catch {
      /* Keep working without storage. */
    }
  }
  function find(id: string) {
    const row = deployments.find((d) => d.id === id)
    if (!row) throw new Error('Deployment not found.')
    return row
  }
  return {
    preview: true,
    async artifacts(p) {
      return structuredClone(p === 'chainvault' ? previewArtifacts : [])
    },
    async networks() {
      return structuredClone(previewNetworks)
    },
    async deployments(p) {
      return structuredClone(deployments.filter((d) => d.projectId === p))
    },
    async deployment(p, id) {
      const row = find(id)
      if (row.projectId !== p) throw new Error('Deployment not found.')
      return structuredClone(row)
    },
    async preflight(_p, draft) {
      const network = previewNetworks.find((n) => n.id === draft.networkId)
      const artifact = previewArtifacts.find((a) => a.id === draft.artifactId)
      const checks = [
        { label: 'Build run passed', passed: Boolean(artifact) },
        { label: 'Artifact matches revision', passed: Boolean(artifact) },
        { label: 'No high-severity alerts', passed: true },
        { label: 'Deployer authorized', passed: Boolean(network) },
        { label: 'Network allowed', passed: Boolean(network) },
        { label: '2 of 2 reviews recorded', passed: true }
      ]
      return {
        eligible: checks.every((c) => c.passed),
        checks,
        estimatedGas: '352410',
        estimatedCost: '0.0068',
        account: network?.account
      }
    },
    async submit(p, draft, key) {
      if (submissions.has(key)) return structuredClone(submissions.get(key)!)
      const artifact = previewArtifacts.find((a) => a.id === draft.artifactId),
        network = previewNetworks.find((n) => n.id === draft.networkId)
      if (!artifact || !network)
        throw new Error('Select an eligible artifact and network.')
      const row: DeploymentRecord = {
        id: crypto.randomUUID(),
        projectId: p,
        artifact,
        network,
        parameters: [...draft.parameters],
        status: 'PENDING',
        requestedBy: 'Preview user',
        submittedAt: new Date().toISOString(),
        transactionHash: `0x${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`,
        confirmations: 0,
        requiredConfirmations: 3
      }
      submissions.set(key, row)
      pending.add(row.id)
      deployments.unshift(row)
      save()
      return structuredClone(row)
    },
    async reconcile(p, id) {
      const row = find(id)
      if (row.projectId !== p) throw new Error('Deployment not found.')
      if (pending.has(id)) {
        row.confirmations = Math.min(
          row.confirmations + 1,
          row.requiredConfirmations
        )
        if (row.confirmations === row.requiredConfirmations) {
          row.status = 'CONFIRMED'
          row.contractAddress = `0x${crypto.randomUUID().replaceAll('-', '')}abcd1234`
          row.blockNumber = 7842312
          row.minedAt = new Date().toISOString()
          row.contractId = crypto.randomUUID()
          row.receipt = {
            status: '0x1',
            contractAddress: row.contractAddress,
            blockNumber: row.blockNumber
          }
          pending.delete(id)
          contracts.unshift({
            id: row.contractId,
            projectId: p,
            name: row.artifact.name,
            version: row.artifact.version,
            address: row.contractAddress,
            network: row.network,
            provenance: 'deployment',
            status: 'Active',
            monitoring: 'Not enabled',
            createdAt: row.minedAt,
            deploymentId: id,
            artifact: row.artifact,
            transactionHash: row.transactionHash
          })
        }
        save()
      }
      return structuredClone(row)
    },
    async contracts(p) {
      return structuredClone(contracts.filter((c) => c.projectId === p))
    },
    async contract(p, id) {
      const row = contracts.find((c) => c.id === id && c.projectId === p)
      if (!row) throw new Error('Contract not found.')
      return structuredClone(row)
    },
    async register(p, input) {
      if (!/^0x[\da-f]{40}$/i.test(input.address) || !input.name.trim())
        throw new Error('Enter valid contract details.')
      const network = previewNetworks.find((n) => n.id === input.networkId)
      if (!network) throw new Error('Select a configured network.')
      if (
        contracts.some(
          (c) =>
            c.projectId === p &&
            c.network.id === input.networkId &&
            c.address.toLowerCase() === input.address.toLowerCase()
        )
      )
        throw new Error('This address is already registered on that network.')
      const row: RegisteredContract = {
        id: crypto.randomUUID(),
        projectId: p,
        ...input,
        version: input.version || 'v1.0',
        network,
        provenance: 'external',
        status: 'Registered',
        monitoring: 'Not enabled',
        createdAt: new Date().toISOString()
      }
      contracts.unshift(row)
      save()
      return structuredClone(row)
    }
  }
}
