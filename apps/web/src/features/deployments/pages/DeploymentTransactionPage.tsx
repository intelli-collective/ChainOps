import { useResource } from '../member2Hooks'
import type { Member2Scope as Scope } from '../types/member2'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DeploymentRecord } from '../types/member2'
import { displayDate, shorten } from '../member2Utils'
import {
  AbiViewer,
  PageHeading,
  Panel,
  PinnedContext,
  ResourceState,
  Status
} from '../components/Member2Ui'

export function TransactionPage({
  projectId,
  service,
  root,
  id,
  detail
}: Scope & { id: string; detail: boolean }) {
  const state = useResource(
    useCallback(
      () => service.deployment(projectId, id),
      [service, projectId, id]
    )
  )
  const [updated, setUpdated] = useState<DeploymentRecord>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [tab, setTab] = useState('Receipt')
  const lock = useRef(false)
  const row = updated ?? state.value
  const reconcile = useCallback(async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      setUpdated(await service.reconcile(projectId, id))
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to recheck this transaction.'
      )
    } finally {
      setBusy(false)
      lock.current = false
    }
  }, [service, projectId, id])
  useEffect(() => {
    if (
      !row ||
      !['PENDING', 'SUBMITTED', 'PREPARING'].includes(row.status) ||
      detail
    )
      return
    const timer = window.setInterval(() => {
      void reconcile()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [row, reconcile, detail])
  if (!row)
    return (
      <>
        <PageHeading
          title="Transaction Details"
          subtitle="View transaction status, timeline and evidence for this deployment."
          crumb="Release › Transaction Details"
          back={`${root}/deployments`}
        />
        <ResourceState {...state} />
      </>
    )
  const confirmed = row.status === 'CONFIRMED',
    registered = Boolean(row.contractId),
    failed = ['FAILED', 'REVERTED'].includes(row.status),
    unknown = row.status === 'UNKNOWN'
  const title = detail
    ? 'Transaction Details'
    : confirmed
      ? 'Deployment confirmed'
      : failed
        ? 'Deployment failed'
        : unknown
          ? 'Deployment outcome unknown'
          : 'Deployment submitted'
  const explorer =
    row.transactionHash && row.network.explorerUrl && !service.preview
      ? `${row.network.explorerUrl}/tx/${row.transactionHash}`
      : undefined
  return (
    <>
      <PageHeading
        title={title}
        subtitle={
          detail
            ? 'View transaction status, timeline and evidence for this deployment.'
            : confirmed || failed || unknown
              ? 'Deployment result and next actions.'
              : 'Follow the deployment transaction status.'
        }
        crumb={
          detail
            ? 'Release › Transaction Details'
            : 'Deployments › New deployment'
        }
        back={`${root}/deployments`}
        action={
          detail && (
            <Link className="m2-secondary" to={`${root}/deployments`}>
              ← Deployments
            </Link>
          )
        }
      />
      {!detail && (
        <ol className="m2-steps">
          <li className="m2-step-active">✓ Preflight passed</li>
          <li className="m2-step-active">
            {row.transactionHash ? '✓ Submitted' : '○ Preparing'}
          </li>
          <li className="m2-step-active">
            {confirmed
              ? '✓ Confirmed'
              : failed
                ? '! Transaction failed'
                : unknown
                  ? '! Confirmation unknown'
                  : '◉ Confirming'}
          </li>
          <li>
            {registered
              ? '✓ Registered'
              : failed || unknown
                ? '○ Not registered'
                : '○ Register contract'}
          </li>
        </ol>
      )}
      <PinnedContext artifact={row.artifact} network={row.network.name} />
      {detail ? (
        <div className="m2-columns m2-transaction-columns">
          <Panel title="Overview">
            <dl className="m2-transaction-details">
              {[
                ['Transaction Hash', row.transactionHash ?? 'Not submitted'],
                ['Status', <Status status={row.status} />],
                ['Network', row.network.name],
                ['Submitted', displayDate(row.submittedAt)],
                ['Mined', displayDate(row.minedAt)],
                [
                  'Confirmations',
                  `${row.confirmations.toLocaleString()} / ${row.requiredConfirmations} required`
                ],
                [
                  'Block Number',
                  row.blockNumber?.toLocaleString() ?? 'Not mined'
                ],
                ['From', row.network.account ?? 'Unavailable'],
                ['To', row.contractAddress ?? 'Contract creation'],
                ['Value', '0 ETH'],
                ['Gas Used', row.gasUsed ?? 'Unavailable'],
                [
                  'Gas Price',
                  row.gasPrice ? `${row.gasPrice} gwei` : 'Unavailable'
                ],
                [
                  'Transaction Fee',
                  row.transactionFee
                    ? `${row.transactionFee} ETH`
                    : 'Unavailable'
                ]
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {explorer && (
              <a href={explorer} target="_blank" rel="noreferrer">
                View on explorer ↗
              </a>
            )}
          </Panel>
          <div className="m2-column-stack">
            <Panel title="Timeline">
              <div className="m2-checks">
                <p>{row.transactionHash ? '✓' : '○'} Transaction submitted</p>
                <p>{row.transactionHash ? '✓' : '○'} Transaction propagated</p>
                <p>{row.blockNumber ? '✓' : '○'} Transaction mined</p>
                <p>
                  {confirmed ? '✓' : failed ? '×' : '○'} Transaction{' '}
                  {confirmed
                    ? 'confirmed'
                    : failed
                      ? 'failed'
                      : 'awaiting confirmation'}
                </p>
              </div>
            </Panel>
            <div
              className="m2-tabs"
              role="tablist"
              aria-label="Transaction evidence"
            >
              {['Receipt', 'Logs', 'Internal calls', 'Raw'].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  className={tab === t ? 'm2-primary' : 'm2-secondary'}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {t === 'Logs' && row.logs ? ` (${row.logs.length})` : ''}
                </button>
              ))}
            </div>
            <Panel className="m2-receipt">
              <div role="tabpanel">
                {tab === 'Receipt' ? (
                  row.receipt ? (
                    <AbiViewer abi={row.receipt} />
                  ) : (
                    <p className="m2-muted">
                      No receipt is available. The outcome remains{' '}
                      {row.status.toLowerCase()}.
                    </p>
                  )
                ) : tab === 'Logs' ? (
                  <AbiViewer abi={row.logs ?? []} />
                ) : tab === 'Internal calls' ? (
                  <p className="m2-muted">
                    Transaction traces are not supplied by the configured
                    provider.
                  </p>
                ) : (
                  <AbiViewer abi={row} />
                )}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel className="m2-outcome">
          <h2
            className={`m2-large-heading ${failed ? 'm2-error' : confirmed ? '' : 'm2-warning'}`}
          >
            {confirmed
              ? `✓ ${row.artifact.name} deployed successfully`
              : failed
                ? '× Transaction reverted'
                : unknown
                  ? '? Transaction outcome uncertain'
                  : '◉ Waiting for confirmation'}
          </h2>
          {confirmed ? (
            <p className="m2-outcome-copy">
              Release: {row.artifact.name} {row.artifact.version} · Revision{' '}
              {row.artifact.commitSha} · Run #{row.artifact.runNumber}
              <br />
              Network: {row.network.name}
              <br />
              Contract address:{' '}
              <span className="m2-wrap">{row.contractAddress}</span>
              <br />
              Constructor parameters:{' '}
              {row.artifact.abi
                .find((a) => a.type === 'constructor')
                ?.inputs?.map((i) => i.name)
                .join(', ') || 'None'}
              <br />
              Registry record: {registered ? 'Active' : 'Awaiting registration'}
            </p>
          ) : failed ? (
            <p className="m2-outcome-copy">
              {row.reason ?? 'The transaction failed.'}
              <br />
              Review the revert reason and constructor values before another
              attempt.
            </p>
          ) : unknown ? (
            <p className="m2-outcome-copy">
              The submission may have reached the network, but no confirmed
              result is available.
              <br />
              Reconcile the transaction hash and receipt before starting another
              deployment.
            </p>
          ) : (
            <p className="m2-outcome-copy">
              ✓ Transaction prepared
              <br />
              {row.transactionHash ? '✓' : '○'} Signature confirmed
              <br />
              {row.transactionHash ? '✓' : '○'} Transaction submitted
              <br />◉ Awaiting inclusion and confirmation
              <br />
              {row.confirmations} / {row.requiredConfirmations} confirmations
            </p>
          )}
          {row.transactionHash && !confirmed && (
            <p>
              <Link to={`${root}/deployments/${id}/transaction`}>
                {row.network.name} transaction: {shorten(row.transactionHash)}
              </Link>
            </p>
          )}
          <div className="m2-actions">
            {confirmed ? (
              <>
                <Link
                  className="m2-primary"
                  to={`${root}/deployments/${id}/transaction`}
                >
                  View transaction
                </Link>
                <Link className="m2-secondary" to={`${root}/contracts`}>
                  Open Contract Registry
                </Link>
              </>
            ) : failed ? (
              <>
                <Link className="m2-secondary" to={`${root}/deployments/new`}>
                  Return to review
                </Link>
                <Link className="m2-primary" to={`${root}/deployments`}>
                  View deployment history
                </Link>
              </>
            ) : (
              <>
                <button
                  className="m2-primary"
                  disabled={busy}
                  onClick={() => {
                    void reconcile()
                  }}
                >
                  {busy
                    ? 'Checking transaction…'
                    : unknown
                      ? 'Recheck transaction status'
                      : 'Refresh transaction status'}
                </button>
                {unknown && (
                  <Link className="m2-secondary" to={`${root}/deployments`}>
                    View deployment history
                  </Link>
                )}
              </>
            )}
          </div>
          {service.preview && !confirmed && !failed && !unknown && (
            <div className="m2-actions">
              <Link
                className="m2-secondary"
                to={`${root}/deployments/deployment-3`}
              >
                View failed attempt
              </Link>
              <Link
                className="m2-secondary"
                to={`${root}/deployments/deployment-4`}
              >
                Investigate missing receipt
              </Link>
            </div>
          )}
        </Panel>
      )}
      {error && (
        <p className="m2-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
