import { useResource } from '../member2Hooks'
import type { Member2Scope as Scope } from '../types/member2'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { displayDate, shorten } from '../member2Utils'
import { PageHeading, ResourceState, Status } from '../components/Member2Ui'

export function DeploymentHistory({ projectId, service, root }: Scope) {
  const state = useResource(
    useCallback(() => service.deployments(projectId), [projectId, service])
  )
  const [query, setQuery] = useState(''),
    [network, setNetwork] = useState(''),
    [status, setStatus] = useState(''),
    [days, setDays] = useState('30')
  const [now] = useState(() => Date.now())
  const rows = (state.value ?? []).filter(
    (d) =>
      (!query ||
        `${d.artifact.name} ${d.artifact.version} ${d.artifact.commitSha} ${d.transactionHash ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!network || d.network.id === network) &&
      (!status ||
        (status === 'FAILED'
          ? ['FAILED', 'REVERTED'].includes(d.status)
          : d.status === status)) &&
      (!days ||
        now - new Date(d.submittedAt).getTime() <= Number(days) * 86400000)
  )
  return (
    <>
      <PageHeading
        title="Deployments"
        subtitle="View and manage contract deployments for this project."
        crumb="Release › Deployments"
        action={
          <Link className="m2-primary" to={`${root}/deployments/new`}>
            + New deployment
          </Link>
        }
      />
      <div className="m2-filters" role="search" aria-label="Filter deployments">
        <input
          aria-label="Search deployments"
          type="search"
          placeholder="Search by transaction, contract, or version…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Network"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
        >
          <option value="">All networks</option>
          {[
            ...new Map(
              state.value?.map((d) => [d.network.id, d.network.name])
            ).entries()
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All status</option>
          {['CONFIRMED', 'PENDING', 'FAILED', 'UNKNOWN'].map((s) => (
            <option key={s} value={s}>
              {s[0] + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Date range"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="30">Last 30 days</option>
          <option value="7">Last 7 days</option>
          <option value="">All time</option>
        </select>
      </div>
      <ResourceState {...state} />
      {state.value && (
        <section className="m2-table-panel m2-deployments-table">
          <div className="m2-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Revision',
                    'Target',
                    'Transaction',
                    'Status',
                    'Requested by',
                    'Date & time',
                    'Actions'
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.artifact.name} {d.artifact.version}
                    </td>
                    <td>
                      {d.targetContracts?.join(', ') ?? d.artifact.name}
                      <small>{d.network.name}</small>
                    </td>
                    <td>
                      <Link
                        to={`${root}/deployments/${d.id}/transaction`}
                        title={d.transactionHash}
                      >
                        {shorten(d.transactionHash)}
                      </Link>
                    </td>
                    <td>
                      <Status status={d.status} />
                    </td>
                    <td>{d.requestedBy}</td>
                    <td>{displayDate(d.submittedAt)}</td>
                    <td>
                      <Link to={`${root}/deployments/${d.id}`}>View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="m2-empty" role="status">
              {state.value.length
                ? 'No deployments match these filters.'
                : 'No deployments yet. Create a deployment from an approved artifact.'}
            </p>
          )}
        </section>
      )}
      {state.value && (
        <p className="m2-muted">Showing {rows.length} deployments</p>
      )}
    </>
  )
}
