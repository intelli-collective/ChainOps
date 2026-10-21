import { useEffect, useRef } from 'react'
import type { ContractRecord } from '../types'

interface Props {
  contract: ContractRecord
  onClose: () => void
  onCopy: () => void
}

export function ContractDetailsDialog({ contract, onClose, onCopy }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="registry-dialog" aria-labelledby="registry-details-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <h2 id="registry-details-title">{contract.name} {contract.version}</h2>
    <p className="registry-dialog-intro">Mock contract record and deployment metadata</p>
    <dl className="registry-details">
      <dt>Address</dt><dd className="registry-address">{contract.address} <button className="registry-link" onClick={onCopy}>Copy address</button></dd>
      <dt>Network</dt><dd>{contract.network}</dd>
      <dt>Monitoring</dt><dd>{contract.monitoring}</dd>
      <dt>Status</dt><dd>{contract.status}</dd>
      <dt>Linked release</dt><dd>{contract.releaseCommit ? `${contract.releaseCommit} · Run #${contract.releaseRun}` : 'None (registered existing contract)'}</dd>
      <dt>Transaction hash</dt><dd className="registry-address">{contract.transactionHash}</dd>
      <dt>Deployment time</dt><dd>{new Date(contract.deployedAt).toLocaleString()}</dd>
    </dl>
    <button className="registry-secondary" autoFocus onClick={onClose}>Close</button>
  </dialog>
}
