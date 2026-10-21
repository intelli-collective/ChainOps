import { Link, useParams } from 'react-router-dom'

export function RoutePlaceholder({ title, back }: { title: string; back?: 'pipelines' | 'security' }) {
  const { projectId, runId, scanId } = useParams()
  return <section className="shell-placeholder">
    <h1>{title}</h1>
    <p>This page is awaiting feature integration.</p>
    {(runId || scanId) && <p>{runId ? 'Run' : 'Scan'}: {runId ?? scanId}</p>}
    <Link to={back && projectId ? `/projects/${encodeURIComponent(projectId)}/${back}` : '/dashboard'}>← Back to {back ?? 'overview'}</Link>
  </section>
}
