import { Link, useParams } from 'react-router-dom'
import './ui.css'

/** Navigation target for a module page that has not been integrated yet (no fake content). */
export function RoutePlaceholder({ title, back, owner }: { title: string; back?: 'pipelines' | 'security'; owner?: string }) {
  const { projectId, runId, scanId } = useParams()
  const backTo = projectId ? `/projects/${encodeURIComponent(projectId)}/${back ?? 'dashboard'}` : '/projects'
  return <section className="co-page">
    <h1 className="co-title">{title}</h1>
    <p className="co-subtitle">{owner ? `This page belongs to ${owner} and is not available in this build yet.` : 'This page is awaiting feature integration.'}</p>
    {(runId || scanId) && <p className="co-help">{runId ? 'Run' : 'Scan'}: {runId ?? scanId}</p>}
    <Link className="co-link" to={backTo}>← Back to {back ?? (projectId ? 'dashboard' : 'projects')}</Link>
  </section>
}
