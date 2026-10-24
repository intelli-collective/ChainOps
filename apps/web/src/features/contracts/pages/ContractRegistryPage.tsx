import { useEffect, useMemo, useState } from 'react'
import { ContractDetailsDialog } from '../components/ContractDetailsDialog'
import { RegisterContractDialog } from '../components/RegisterContractDialog'
import { mockRegistryService } from '../services/registryService'
import type { ContractRecord, ContractRegistryService } from '../types'
import '../registry.css'

interface Props {
  projectId: string
  service?: ContractRegistryService
}

type RegistryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; contracts: ContractRecord[] }

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function ContractRegistryPage({ projectId, service = mockRegistryService }: Props) {
  const [state, setState] = useState<RegistryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [network, setNetwork] = useState('all')
  const [contractName, setContractName] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<ContractRecord | null>(null)
  const [registering, setRegistering] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    let active = true
    service.getContracts(projectId).then((contracts) => {
      if (active) setState({ status: 'ready', contracts })
    }).catch(() => {
      if (active) setState({ status: 'error' })
    })
    return () => { active = false }
  }, [projectId, service, attempt])

  const contracts = useMemo(() => state.status === 'ready' ? state.contracts : [], [state])
  const networks = useMemo(() => [...new Set(contracts.map((item) => item.network))].sort(), [contracts])
  const names = useMemo(() => [...new Set(contracts.map((item) => item.name))].sort(), [contracts])
  const filtered = useMemo(() => contracts.filter((item) => {
    const term = query.trim().toLowerCase()
    return (!term || [item.name, item.address, item.version].some((value) => value.toLowerCase().includes(term)))
      && (network === 'all' || item.network === network)
      && (contractName === 'all' || item.name === contractName)
      && (status === 'all' || item.status === status)
  }), [contracts, query, network, contractName, status])

  async function copyAddress(contract: ContractRecord) {
    try {
      await navigator.clipboard.writeText(contract.address)
      setCopyMessage(`${contract.name} address copied to clipboard.`)
    } catch {
      setCopyMessage('Unable to copy the address. You can select it in contract details.')
      setSelected(contract)
    }
  }

  function addContract(contract: ContractRecord) {
    setState((current) => current.status === 'ready' ? { status: 'ready', contracts: [contract, ...current.contracts] } : current)
    setQuery('')
    setNetwork('all')
    setContractName('all')
    setStatus('all')
    setRegistering(false)
    setSelected(contract)
  }

  return <main className="registry-page">
    <nav className="registry-breadcrumb" aria-label="Breadcrumb"><span>Release</span><span aria-hidden="true">›</span><span aria-current="page">Contract Registry</span></nav>
    <div className="registry-heading-row"><h1>Contract Registry</h1><button className="registry-primary" onClick={() => setRegistering(true)}>+ Register existing contract</button></div>
    <p className="registry-intro">View deployed contracts, their versions, and monitoring status.</p>
    <div className="registry-filters" role="search" aria-label="Filter contracts">
      <label className="registry-sr-only" htmlFor="registry-search">Search contracts by name, address, or version</label>
      <input id="registry-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, address, or version..." />
      <label className="registry-sr-only" htmlFor="registry-network">Network</label>
      <select id="registry-network" value={network} onChange={(event) => setNetwork(event.target.value)}><option value="all">All networks</option>{networks.map((item) => <option key={item}>{item}</option>)}</select>
      <label className="registry-sr-only" htmlFor="registry-contract">Contract</label>
      <select id="registry-contract" value={contractName} onChange={(event) => setContractName(event.target.value)}><option value="all">All contracts</option>{names.map((item) => <option key={item}>{item}</option>)}</select>
      <label className="registry-sr-only" htmlFor="registry-status">Status</label>
      <select id="registry-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
    </div>

    <section className="registry-table-wrap" aria-label="Deployed contracts">
      {state.status === 'loading' && <p className="registry-state" role="status">Loading contracts…</p>}
      {state.status === 'error' && <div className="registry-state"><p role="alert">Contracts could not be loaded.</p><button className="registry-secondary" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Try again</button></div>}
      {state.status === 'ready' && !contracts.length && <p className="registry-state" role="status">No contracts are registered for this project.</p>}
      {state.status === 'ready' && contracts.length > 0 && !filtered.length && <div className="registry-state"><p role="status">No contracts match these filters.</p><button className="registry-link" onClick={() => { setQuery(''); setNetwork('all'); setContractName('all'); setStatus('all') }}>Clear filters</button></div>}
      {state.status === 'ready' && filtered.length > 0 && <div className="registry-table-scroll"><table>
        <thead><tr><th scope="col">Name</th><th scope="col">Version</th><th scope="col">Address</th><th scope="col">Network</th><th scope="col">Monitoring</th><th scope="col">Status</th><th scope="col">Linked Release</th></tr></thead>
        <tbody>{filtered.map((contract) => <tr key={contract.id}>
          <td><button className="registry-name-button" onClick={() => setSelected(contract)} aria-label={`View ${contract.name} details`}>{contract.name}</button></td>
          <td>{contract.version}</td>
          <td><button className="registry-link" onClick={() => { void copyAddress(contract) }} title={`Copy ${contract.address}`} aria-label={`Copy ${contract.name} address ${contract.address}`}>{shortAddress(contract.address)}</button></td>
          <td>{contract.network}</td>
          <td><span className={`registry-indicator ${contract.monitoring === 'Degraded' ? 'registry-warning' : ''}`}>● {contract.monitoring}</span></td>
          <td><span className={`registry-indicator ${contract.status === 'Inactive' ? 'registry-warning' : ''}`}>● {contract.status}</span></td>
          <td>{contract.releaseCommit ? <button className="registry-link" onClick={() => setSelected(contract)} aria-label={`View ${contract.name} linked release`}>{contract.releaseCommit} · #{contract.releaseRun}</button> : <span className="registry-muted">—</span>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <p className="registry-copy-message" role="status" aria-live="polite">{copyMessage}</p>
    {selected && <ContractDetailsDialog contract={selected} onClose={() => setSelected(null)} onCopy={() => { void copyAddress(selected) }} />}
    {registering && <RegisterContractDialog projectId={projectId} service={service} onClose={() => setRegistering(false)} onRegistered={addContract} />}
  </main>
}
