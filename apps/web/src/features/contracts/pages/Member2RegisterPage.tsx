import { useResource } from '../../deployments/member2Hooks'
import type { Member2Scope as Scope } from '../../deployments/types/member2'
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  PageHeading,
  Panel,
  ResourceState
} from '../../deployments/components/Member2Ui'

export function RegisterPage({ projectId, service, root }: Scope) {
  const navigate = useNavigate(),
    networks = useResource(
      useCallback(() => service.networks(projectId), [service, projectId])
    )
  const [name, setName] = useState(''),
    [version, setVersion] = useState('v1.0'),
    [address, setAddress] = useState(''),
    [networkId, setNetworkId] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function submit() {
    if (lock.current) return
    const next: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 120)
      next.name = 'Enter a contract name of 1–120 characters.'
    if (version.length > 80) next.version = 'Use 80 characters or fewer.'
    if (!/^0x[\da-f]{40}$/i.test(address) || /^0x0{40}$/i.test(address))
      next.address = 'Enter a valid, nonzero 42-character Ethereum address.'
    if (!networkId) next.networkId = 'Select a configured network.'
    setErrors(next)
    if (Object.keys(next).length) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const c = await service.register(projectId, {
        name: name.trim(),
        version: version.trim() || 'v1.0',
        address,
        networkId
      })
      navigate(`${root}/contracts/${c.id}`)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to register this contract.'
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading
        title="Register existing contract"
        subtitle="Add a known contract address to your project registry."
        crumb="Release › Register existing contract"
        back={`${root}/contracts`}
      />
      <ResourceState {...networks} />
      {networks.value && (
        <Panel title="Contract details" className="m2-register-panel">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="m2-field">
              <label htmlFor="contract-name">Contract name *</label>
              <input
                id="contract-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? 'contract-name-error' : undefined
                }
              />
              {errors.name && (
                <span id="contract-name-error" className="m2-error">
                  {errors.name}
                </span>
              )}
            </div>
            <div className="m2-field">
              <label htmlFor="contract-network">Network *</label>
              <select
                id="contract-network"
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                aria-invalid={Boolean(errors.networkId)}
                aria-describedby={
                  errors.networkId ? 'contract-network-error' : undefined
                }
              >
                <option value="">Select network</option>
                {networks.value.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
              {errors.networkId && (
                <span id="contract-network-error" className="m2-error">
                  {errors.networkId}
                </span>
              )}
            </div>
            <div className="m2-field">
              <label htmlFor="contract-address">Contract address *</label>
              <input
                id="contract-address"
                spellCheck={false}
                autoComplete="off"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                aria-invalid={Boolean(errors.address)}
                aria-describedby={
                  errors.address ? 'contract-address-error' : undefined
                }
              />
              {errors.address && (
                <span id="contract-address-error" className="m2-error">
                  {errors.address}
                </span>
              )}
            </div>
            <div className="m2-field">
              <label htmlFor="contract-version">Version</label>
              <input
                id="contract-version"
                value={version}
                maxLength={80}
                onChange={(e) => setVersion(e.target.value)}
                aria-invalid={Boolean(errors.version)}
              />
              {errors.version && (
                <span className="m2-error">{errors.version}</span>
              )}
            </div>
            <p className="m2-muted">
              Registration adds a registry record. It does not deploy a
              contract.
            </p>
            {error && (
              <p role="alert" className="m2-error">
                {error}
              </p>
            )}
            <div className="m2-actions">
              <Link className="m2-secondary" to={`${root}/contracts`}>
                Cancel
              </Link>
              <button
                className="m2-primary"
                disabled={busy || !networks.value.length}
              >
                {busy ? 'Registering…' : 'Register contract →'}
              </button>
            </div>
            {!networks.value.length && (
              <p role="status" className="m2-warning">
                No project environments are configured.
              </p>
            )}
          </form>
        </Panel>
      )}
    </>
  )
}
