import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { DeploymentArtifact, TransactionStatus } from '../types/member2'

export function ResourceState({
  loading,
  error,
  reload
}: {
  loading: boolean
  error?: string
  reload: () => void
}) {
  return loading ? (
    <section className="m2-panel m2-empty" role="status">
      Loading…
    </section>
  ) : error ? (
    <section className="m2-panel m2-empty">
      <p role="alert" className="m2-error">
        {error}
      </p>
      <button className="m2-secondary" onClick={reload}>
        Try again
      </button>
    </section>
  ) : null
}
export function PageHeading({
  title,
  subtitle,
  crumb,
  back,
  action
}: {
  title: string
  subtitle: string
  crumb: string
  back?: string
  action?: ReactNode
}) {
  return (
    <>
      <nav className="m2-breadcrumb" aria-label="Breadcrumb">
        {back && (
          <Link className="m2-back" to={back}>
            ← Back
          </Link>
        )}
        <span>{crumb}</span>
      </nav>
      <div className="m2-heading">
        <h1>{title}</h1>
        {action}
      </div>
      <p className="m2-intro">{subtitle}</p>
    </>
  )
}
export function PinnedContext({
  artifact,
  network
}: {
  artifact: DeploymentArtifact
  network?: string
}) {
  return (
    <div className="m2-context">
      Release context (pinned)<span>commit {artifact.commitSha}</span>
      <span>run #{artifact.runNumber}</span>
      <span>
        {artifact.name} {artifact.version}
      </span>
      {network && <span>{network}</span>}
    </div>
  )
}
export function Panel({
  title,
  children,
  className = ''
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`m2-panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}
export function Status({ status }: { status: TransactionStatus }) {
  const failed = status === 'FAILED' || status === 'REVERTED',
    success = status === 'CONFIRMED'
  return (
    <span
      className={failed ? 'm2-error' : success ? 'm2-link-color' : 'm2-warning'}
    >
      {success
        ? '● Confirmed'
        : failed
          ? '× Failed'
          : status === 'UNKNOWN'
            ? '? Unknown'
            : status === 'PREPARING'
              ? '○ Preparing'
              : '◉ Pending'}
    </span>
  )
}
export function AbiViewer({ abi }: { abi: unknown }) {
  return <pre className="m2-code">{JSON.stringify(abi, null, 2)}</pre>
}
