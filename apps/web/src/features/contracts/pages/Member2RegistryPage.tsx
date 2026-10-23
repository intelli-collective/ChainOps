import { useResource } from '../../deployments/member2Hooks'
import type { Member2Scope as Scope } from '../../deployments/types/member2'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { shorten } from '../../deployments/member2Utils'
import {
  PageHeading,
  ResourceState
} from '../../deployments/components/Member2Ui'

export function RegistryPage({ projectId, service, root }: Scope) {
  const state = useResource(
    useCallback(() => service.contracts(projectId), [service, projectId])
  )
  const [query, setQuery] = useState(''),
    [network, setNetwork] = useState(''),
    [name, setName] = useState(''),
    [status, setStatus] = useState('')
  const rows = (state.value ?? []).filter(
    (c) =>
      (!query ||
        `${c.name} ${c.version} ${c.address}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!network || c.network.id === network) &&
      (!name || c.name === name) &&
      (!status || c.status === status)
  )
  return (
    <>
      <PageHeading
        title="Contract Registry"
        subtitle="View deployed contracts, their versions, and monitoring status."
        crumb="Release › Contract Registry"
        action={
          <Link className="m2-primary" to={`${root}/contracts/register`}>
            + Register existing contract
          </Link>
        }
      />
      <div className="m2-filters" role="search" aria-label="Filter contracts">
        <input
          aria-label="Search contracts"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address, or version…"
        />
        <select
          aria-label="Network"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
        >
          <option value="">All networks</option>
          {[
            ...new Map(
              state.value?.map((c) => [c.network.id, c.network.name])
            ).entries()
          ].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Contract"
          value={name}
          onChange={(e) => setName(e.target.value)}
        >
          <option value="">All contracts</option>
          {[...new Set(state.value?.map((c) => c.name))].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All status</option>
          {['Active', 'Registered', 'Inactive'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <ResourceState {...state} />
      {state.value && (
        <section className="m2-table-panel m2-registry-table">
          <div className="m2-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Name',
                    'Version',
                    'Address',
                    'Network',
                    'Monitoring',
                    'Status',
                    'Linked Release'
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        className="m2-name-link"
                        to={`${root}/contracts/${c.id}`}
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.version}</td>
                    <td>
                      <Link to={`${root}/contracts/${c.id}`} title={c.address}>
                        {shorten(c.address)}
                      </Link>
                    </td>
                    <td>{c.network.name.replace(' Testnet', '')}</td>
                    <td>
                      <span
                        className={
                          c.monitoring === 'Healthy'
                            ? 'm2-link-color'
                            : c.monitoring === 'Degraded'
                              ? 'm2-warning'
                              : 'm2-muted'
                        }
                      >
                        {c.monitoring === 'Not enabled' ? '' : '● '}
                        {c.monitoring}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          c.status === 'Active' ? 'm2-link-color' : 'm2-muted'
                        }
                      >
                        {c.status === 'Active' ? '● ' : ''}
                        {c.status}
                      </span>
                    </td>
                    <td>
                      {c.artifact ? (
                        <Link to={`${root}/contracts/${c.id}`}>
                          {c.artifact.commitSha} · #{c.artifact.runNumber}
                        </Link>
                      ) : (
                        'External registration'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p role="status" className="m2-empty">
              {state.value.length
                ? 'No contracts match these filters.'
                : 'No contracts are registered for this project.'}
            </p>
          )}
        </section>
      )}
    </>
  )
}
