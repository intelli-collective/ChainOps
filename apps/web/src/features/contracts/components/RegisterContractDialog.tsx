import { useEffect, useRef, useState } from 'react'
import type { ContractRecord, ContractRegistryService } from '../types'

interface Props {
  projectId: string
  service: ContractRegistryService
  onClose: () => void
  onRegistered: (record: ContractRecord) => void
}

export function RegisterContractDialog({ projectId, service, onClose, onRegistered }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('Sepolia')
  const [transactionHash, setTransactionHash] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter a contract name.'
    if (!version.trim()) next.version = 'Enter a version.'
    if (!/^0x[a-f\d]{40}$/i.test(address.trim())) next.address = 'Enter a 42-character EVM address beginning with 0x.'
    if (!/^0x[a-f\d]{64}$/i.test(transactionHash.trim())) next.transactionHash = 'Enter a 66-character transaction hash beginning with 0x.'
    setErrors(next)
    if (Object.keys(next).length) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const record = await service.registerExistingContract({ projectId, name, version, address, network, transactionHash })
      onRegistered(record)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to register this contract in the mock registry.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return <dialog ref={dialog} className="registry-dialog" aria-labelledby="registry-register-title" onCancel={(event) => { event.preventDefault(); if (!submitting) onClose() }}>
    <h2 id="registry-register-title">Register existing contract</h2>
    <p className="registry-dialog-intro">Add a contract to this local preview. No blockchain data is fetched or changed.</p>
    <form noValidate onSubmit={(event) => { void submit(event) }}>
      <div className="registry-field"><label htmlFor="register-name">Contract name</label><input id="register-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} />{errors.name && <span id="register-name-error" className="registry-error">{errors.name}</span>}</div>
      <div className="registry-field"><label htmlFor="register-version">Version</label><input id="register-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="v1.0" aria-invalid={Boolean(errors.version)} aria-describedby={errors.version ? 'register-version-error' : undefined} />{errors.version && <span id="register-version-error" className="registry-error">{errors.version}</span>}</div>
      <div className="registry-field"><label htmlFor="register-address">Contract address</label><input id="register-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'register-address-error' : undefined} />{errors.address && <span id="register-address-error" className="registry-error">{errors.address}</span>}</div>
      <div className="registry-field"><label htmlFor="register-network">Network</label><select id="register-network" value={network} onChange={(event) => setNetwork(event.target.value)}><option>Sepolia</option><option>Ethereum Mainnet</option></select></div>
      <div className="registry-field"><label htmlFor="register-transaction">Deployment transaction hash</label><input id="register-transaction" value={transactionHash} onChange={(event) => setTransactionHash(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-invalid={Boolean(errors.transactionHash)} aria-describedby={errors.transactionHash ? 'register-transaction-error' : undefined} />{errors.transactionHash && <span id="register-transaction-error" className="registry-error">{errors.transactionHash}</span>}</div>
      {submitError && <p className="registry-error" role="alert">{submitError}</p>}
      <div className="registry-dialog-actions"><button className="registry-secondary" type="button" disabled={submitting} onClick={onClose}>Cancel</button><button className="registry-primary" disabled={submitting}>{submitting ? 'Adding to preview…' : 'Add to preview'}</button></div>
    </form>
  </dialog>
}
