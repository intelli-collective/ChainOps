import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ProjectGate, StateMessage } from '../components/PageChrome'
import { RunProvenance } from '../components/RunProvenance'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { ArtifactDetails, ProjectSummary } from '../types/pipelineRun'
import { pipelineRunPath, pipelineRunsPath } from '../utils/pipelineRun'
import '../pipelines.css'

type View = 'abi' | 'bytecode' | 'metadata'
const fileName = (path: string) => path.split('/').pop() ?? path

/** Frame 30 · Build Artifacts produced by one run (read-only; nothing is recompiled or deployed). */
export function ArtifactsPage({ projectId, runId, api = pipelineApi }: { projectId: string; runId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="build artifacts">{(project) => <ArtifactsView project={project} routeId={projectId} runId={runId} api={api} />}</ProjectGate>
}

function ArtifactsView({ project, routeId, runId, api }: { project: ProjectSummary; routeId: string; runId: string; api: PipelineApi }) {
  const { state, reload } = useLoad(async () => ({ run: await api.getRun(project.id, runId), artifacts: await api.listArtifacts(project.id, runId) }), [project.id, runId])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('abi')

  const artifacts = useMemo(() => (state.status === 'ready' ? state.data.artifacts : []), [state])
  const visible = artifacts.filter((item) => `${item.contractName} ${item.sourcePath}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = artifacts.find((item) => item.id === selectedId) ?? visible[0]
  const runNumber = state.status === 'ready' ? state.data.run.runNumber : null

  return (
    <section className="pr-page" aria-labelledby="artifacts-title">
      <PageHeader back={pipelineRunPath(routeId, runId)} crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: 'Build Artifacts' }]} title="Build Artifacts"
        subtitle={runNumber !== null ? `Compiled contract artifacts, ABIs, and metadata from run #${runNumber}.` : 'Compiled contract artifacts, ABIs, and metadata.'}
        actions={<Link className="pr-outline-button pr-outline-button--wide" to={pipelineRunPath(routeId, runId)}><span aria-hidden="true">←</span> View run</Link>} />
      {state.status === 'loading' && <div className="pr-card" aria-busy="true"><span className="pr-skeleton pr-skeleton--wide" /><span className="pr-skeleton" /></div>}
      {state.status === 'error' && (state.code === 404 || state.code === 400
        ? <StateMessage title="Pipeline run not found" body="This run doesn’t exist in this project." action={<Link className="pr-secondary-button" to={pipelineRunsPath(routeId)}>Back to pipeline runs</Link>} />
        : <StateMessage role="alert" title="Couldn’t load artifacts" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />)}
      {state.status === 'ready' && (
        <>
          <RunProvenance run={state.data.run} />
          {artifacts.length === 0 ? (
            <StateMessage title="No artifacts for this run"
              body={state.data.run.status === 'success' || state.data.run.stages.find((stage) => stage.key === 'build')?.status === 'success'
                ? 'The build completed but produced no project contract artifacts.'
                : 'Artifacts are captured when the build stage succeeds.'} />
          ) : (
            <div className="pr-artifacts">
              <aside className="pr-card pr-artifacts__list" aria-label="Artifacts">
                <h2 className="pr-card__subtitle">Artifacts</h2>
                <input type="search" className="pr-control pr-control--block" placeholder="Search artifacts…" aria-label="Search artifacts" value={query} onChange={(event) => setQuery(event.target.value)} />
                <ul>
                  {visible.map((item) => (
                    <li key={item.id}>
                      <button type="button" className={`pr-artifact-item${selected?.id === item.id ? ' is-active' : ''}`} aria-current={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
                        {fileName(item.artifactPath)}
                        <span>{item.sourcePath}</span>
                      </button>
                    </li>
                  ))}
                  {visible.length === 0 && <li className="pr-help">No artifacts match “{query}”.</li>}
                </ul>
              </aside>
              <div className="pr-card pr-artifacts__viewer">
                {selected && <ArtifactViewer key={selected.id} projectId={project.id} runId={runId} artifactId={selected.id} runNumber={runNumber} view={view} onView={setView} api={api} />}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ArtifactViewer({ projectId, runId, artifactId, runNumber, view, onView, api }: {
  projectId: string; runId: string; artifactId: string; runNumber: number | null; view: View; onView: (view: View) => void; api: PipelineApi
}) {
  const { state, reload } = useLoad<ArtifactDetails>(() => api.getArtifact(projectId, runId, artifactId), [artifactId])
  const views: { key: View; label: string }[] = [{ key: 'abi', label: 'ABI' }, { key: 'bytecode', label: 'Bytecode' }, { key: 'metadata', label: 'Metadata' }]
  if (state.status === 'loading') return <div aria-busy="true"><span className="pr-skeleton pr-skeleton--title" /><span className="pr-skeleton" /></div>
  if (state.status === 'error') return <StateMessage role="alert" title="Couldn’t load this artifact" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />
  const artifact = state.data
  const content = view === 'abi'
    ? JSON.stringify(artifact.abi, null, 2)
    : view === 'bytecode'
      ? `Creation bytecode (${(artifact.bytecode.length - 2) / 2} bytes)\n${artifact.bytecode}\n\nDeployed bytecode (${(artifact.deployedBytecode.length - 2) / 2} bytes)\n${artifact.deployedBytecode}`
      : JSON.stringify({ contractName: artifact.contractName, sourcePath: artifact.sourcePath, artifactPath: artifact.artifactPath, compilerVersion: artifact.compilerVersion, ...artifact.metadata, artifactId: artifact.id, runId: artifact.runId, createdAt: artifact.createdAt }, null, 2)
  return (
    <>
      <div className="pr-tabs pr-tabs--compact" role="tablist" aria-label="Artifact view">
        {views.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={view === item.key} className={`pr-tab${view === item.key ? ' is-active' : ''}`} onClick={() => onView(item.key)}>{item.label}</button>
        ))}
      </div>
      {/* Rendered as text in a <pre>: artifact content is never interpreted as HTML. */}
      <pre className={`pr-code${view === 'bytecode' ? ' pr-code--wrap' : ''}`} tabIndex={0} aria-label={`${artifact.contractName} ${view}`}>{content}</pre>
      <p className="pr-artifact-meta">
        <span>{fileName(artifact.artifactPath)}</span><span aria-hidden="true">·</span><span>JSON</span>
        {artifact.compilerVersion && <><span aria-hidden="true">·</span><span>solc {artifact.compilerVersion}</span></>}
        {runNumber !== null && <><span aria-hidden="true">·</span><span>Run #{runNumber}</span></>}
      </p>
    </>
  )
}
