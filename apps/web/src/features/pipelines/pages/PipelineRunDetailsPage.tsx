import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogViewer, PageHeader, ProjectGate, StateMessage } from '../components/PageChrome'
import { RunProvenance } from '../components/RunProvenance'
import { StagePanel } from '../components/StagePanel'
import { StageStepper } from '../components/StageStepper'
import { useLoad } from '../hooks/usePipelineData'
import { pipelineApi, type PipelineApi } from '../services/pipelineApi'
import type { PipelineRunDetails, PipelineStage, ProjectSummary, StageKey } from '../types/pipelineRun'
import {
  artifactsPath,
  defaultStage,
  formatDuration,
  formatStartedAt,
  isActiveRun,
  pipelineRunPath,
  pipelineRunsPath,
  RUN_TRIGGER_LABELS,
  STAGE_STATUS_LABELS,
} from '../utils/pipelineRun'
import '../pipelines.css'

type Tab = 'summary' | 'build-logs' | 'test-logs' | 'findings'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' }, { key: 'build-logs', label: 'Build logs' }, { key: 'test-logs', label: 'Test logs' }, { key: 'findings', label: 'Findings' },
]
const FAILURE_TEXT: Partial<Record<StageKey, string>> = { checkout: 'Checkout failed', build: 'Build failed', test: 'Tests did not pass' }
const STAGE_GLYPH = { success: '✓', failed: '✕', running: '◉', cancelled: '⊘', pending: '○', skipped: '○' } as const

/** Frames 25 (running), 26 (passed), 27/28 (logs) and 29 (failed): one run, shown by state. */
export function PipelineRunDetailsPage({ projectId, runId, api = pipelineApi }: { projectId: string; runId: string; api?: PipelineApi }) {
  return <ProjectGate projectRef={projectId} label="this pipeline run">{(project) => <RunView key={runId} project={project} routeId={projectId} runId={runId} api={api} />}</ProjectGate>
}

function subtitleFor(run: PipelineRunDetails): { text: string; tone?: 'success' | 'danger' | 'warning' } {
  const trigger = run.trigger === 'manual' ? 'Triggered manually' : `${RUN_TRIGGER_LABELS[run.trigger]} to ${run.branch}`
  switch (run.status) {
    case 'queued': return { text: `${trigger} · Queued — waiting for a worker` }
    case 'running': return { text: `${trigger} · ${run.cancelRequested ? 'Cancelling…' : 'Running'}` }
    case 'success': return { text: `Passed · ${trigger}`, tone: 'success' }
    case 'failed': return { text: `Failed · ${(run.failureStage && FAILURE_TEXT[run.failureStage]) ?? run.failureReason ?? 'A stage failed'}`, tone: 'danger' }
    case 'error': return { text: `Error · ${run.failureReason ?? 'The run could not be executed'}`, tone: 'warning' }
    case 'cancelled': return { text: `Cancelled · ${trigger}` }
  }
}

function RunView({ project, routeId, runId, api }: { project: ProjectSummary; routeId: string; runId: string; api: PipelineApi }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { state, reload, replace } = useLoad(() => api.getRun(project.id, runId), [project.id, runId], { poll: (run) => isActiveRun(run.status), intervalMs: 3000 })
  const [selectedStage, setSelectedStage] = useState<StageKey | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const panelId = useId()
  const tab = (TABS.find((item) => item.key === params.get('tab'))?.key ?? 'summary')

  if (state.status === 'loading') {
    return (
      <section className="pr-page" aria-busy="true">
        <PageHeader back={pipelineRunsPath(routeId)} crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: 'Pipeline Run' }]} title="Pipeline Run" />
        <div className="pr-provenance"><span className="pr-skeleton pr-skeleton--wide" /></div>
        <div className="pr-card"><span className="pr-skeleton pr-skeleton--title" /><span className="pr-skeleton" /><span className="pr-skeleton" /></div>
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="pr-page">
        <PageHeader back={pipelineRunsPath(routeId)} crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: 'Pipeline Run' }]} title="Pipeline Run" />
        {state.code === 404 || state.code === 400
          ? <StateMessage title="Pipeline run not found" body="This run doesn’t exist in this project." action={<Link className="pr-secondary-button" to={pipelineRunsPath(routeId)}>Back to pipeline runs</Link>} />
          : <StateMessage role="alert" title="Couldn’t load this pipeline run" body={state.message} action={<button type="button" className="pr-secondary-button" onClick={reload}>Retry</button>} />}
      </section>
    )
  }

  const run = state.data
  const active = isActiveRun(run.status)
  const subtitle = subtitleFor(run)
  const stage = run.stages.find((item) => item.key === selectedStage) ?? defaultStage(run.stages)
  const failed = run.stages.find((item) => item.key === run.failureStage)

  const cancel = async () => {
    setBusy(true)
    try {
      await api.cancelRun(project.id, run.id)
      setConfirmCancel(false)
      setNotice('Cancellation requested. The worker stops the running stage.')
      replace(await api.getRun(project.id, run.id))
      reload()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not cancel the run.')
    } finally {
      setBusy(false)
    }
  }
  const rerun = async () => {
    setBusy(true)
    try {
      const next = await api.rerun(project.id, run.id)
      navigate(pipelineRunPath(routeId, next.id))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start a re-run.')
      setBusy(false)
    }
  }

  const actions = active
    ? (confirmCancel
      ? <div className="pr-confirm" role="group" aria-label="Confirm cancellation">
          <span>Cancel this run?</span>
          <button type="button" className="pr-outline-button" onClick={() => setConfirmCancel(false)} disabled={busy}>Keep running</button>
          <button type="button" className="pr-danger-button" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel run'}</button>
        </div>
      : <button type="button" className="pr-outline-button pr-outline-button--wide" onClick={() => setConfirmCancel(true)} disabled={run.cancelRequested}>{run.cancelRequested ? 'Cancelling…' : 'Cancel run'}</button>)
    : <button type="button" className="pr-outline-button pr-outline-button--wide" onClick={rerun} disabled={busy}><span aria-hidden="true">↻</span> {busy ? 'Starting…' : 'Re-run'}</button>

  return (
    <section className="pr-page" aria-labelledby="pipeline-run-title">
      <PageHeader back={pipelineRunsPath(routeId)} crumbs={[{ label: 'Pipelines', to: pipelineRunsPath(routeId) }, { label: `Pipeline Run #${run.runNumber}` }]}
        title={`Pipeline Run #${run.runNumber}`} subtitle={subtitle.text} subtitleTone={subtitle.tone} actions={actions} />
      {notice && (
        <div className="pr-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="pr-text-button" onClick={() => setNotice(null)} aria-label="Dismiss notice">Dismiss</button>
        </div>
      )}
      <RunProvenance run={run} />

      {active && stage && (
        <div className="pr-card pr-stage-card">
          <StageStepper stages={run.stages} selected={stage.key} panelId={panelId} onSelect={setSelectedStage} />
          <StagePanel key={stage.key} id={panelId} stage={stage} live={stage.status === 'running'} />
        </div>
      )}

      {!active && (run.status === 'failed' || run.status === 'error') && (
        <>
          <ol className="pr-inline-stages" aria-label="Pipeline stages">
            {run.stages.map((item, index) => (
              <li key={item.key} className={`pr-stage--${item.status}`}>
                <span aria-hidden="true">{STAGE_GLYPH[item.status]}</span> {item.name}<span className="pr-visually-hidden">: {STAGE_STATUS_LABELS[item.status]}</span>
                {index < run.stages.length - 1 && <span className="pr-inline-stages__arrow" aria-hidden="true">→</span>}
              </li>
            ))}
          </ol>
          <div className="pr-card pr-failure" role="alert">
            <h2 className="pr-card__title">{failed ? `${failed.name} stage failed` : 'Run could not be executed'}</h2>
            {run.failureReason && <p className="pr-failure__reason">{run.failureReason}</p>}
            {failed && <LogViewer lines={failed.logs.filter((line) => line.trim()).slice(-8)} label={`${failed.name} log excerpt`} empty="No output was captured." />}
            {run.stages.some((item) => (item.key === 'slither' || item.key === 'policy') && item.status !== 'success') && <p className="pr-failure__note">Security and policy stages were not started.</p>}
            <Link className="pr-link" to={pipelineRunsPath(routeId)}><span aria-hidden="true">←</span> Back to pipeline runs</Link>
          </div>
        </>
      )}

      {!active && run.status !== 'failed' && run.status !== 'error' && (
        <ol className="pr-stage-summary" aria-label="Stage results">
          {run.stages.map((item) => (
            <li key={item.key} className={`pr-stage--${item.status}`}>
              <span aria-hidden="true">{STAGE_GLYPH[item.status]}</span> {item.name}
              {item.durationSeconds !== null ? ` · ${formatDuration(item.durationSeconds)}` : ` · ${STAGE_STATUS_LABELS[item.status]}`}
            </li>
          ))}
        </ol>
      )}

      {!active && (
        <>
          <div className="pr-tabs" role="tablist" aria-label="Run details">
            {TABS.map((item) => (
              <button key={item.key} type="button" role="tab" id={`run-tab-${item.key}`} aria-selected={tab === item.key} aria-controls="run-tab-panel"
                className={`pr-tab${tab === item.key ? ' is-active' : ''}`}
                onClick={() => setParams(item.key === 'summary' ? {} : { tab: item.key }, { replace: true })}>{item.label}</button>
            ))}
            <Link className="pr-tab" to={artifactsPath(routeId, run.id)}>Artifacts</Link>
          </div>
          <div id="run-tab-panel" role="tabpanel" aria-labelledby={`run-tab-${tab}`} className="pr-card pr-tab-panel">
            {tab === 'summary' && <RunSummary run={run} />}
            {tab === 'build-logs' && <StageLog stage={run.stages.find((item) => item.key === 'build')} title="Build logs" />}
            {tab === 'test-logs' && <StageLog stage={run.stages.find((item) => item.key === 'test')} title="Test logs" />}
            {tab === 'findings' && (
              <>
                <div className="pr-panel-heading"><h2>Security findings</h2></div>
                <p className="pr-help">Slither analysis and policy decisions are produced by the Security module (M4) and are not attached to pipeline runs yet. This run’s build and test evidence is available to it through run #{run.runNumber}.</p>
                <Link className="pr-link" to={`/projects/${encodeURIComponent(routeId)}/security`}>Open Security Scans <span aria-hidden="true">→</span></Link>
              </>
            )}
          </div>
          <Link className="pr-link" to={pipelineRunsPath(routeId)}><span aria-hidden="true">←</span> All pipeline runs</Link>
        </>
      )}
    </section>
  )
}

function StageLog({ stage, title }: { stage: PipelineStage | undefined; title: string }) {
  if (!stage) return <p className="pr-log-empty">This stage is not part of the run.</p>
  return (
    <>
      <div className="pr-panel-heading">
        <h2>{title}</h2>
        <span className={`pr-stage--${stage.status}`}>{stage.status === 'success' ? 'Completed' : STAGE_STATUS_LABELS[stage.status]}</span>
      </div>
      {stage.skipReason && <p className="pr-help">{stage.skipReason}</p>}
      <LogViewer lines={stage.logs} label={title} empty={stage.status === 'skipped' ? 'This stage did not run.' : 'No output was captured.'} />
    </>
  )
}

function RunSummary({ run }: { run: PipelineRunDetails }) {
  const rows: [string, ReactNode][] = [
    ['Repository', run.repository],
    ['Commit', <code className="pr-sha" key="sha">{run.commitSha}</code>],
    ['Branch', run.branch],
    ['Trigger', `${RUN_TRIGGER_LABELS[run.trigger]} by ${run.author}`],
    ['Queued', formatStartedAt(run.queuedAt)],
    ['Finished', run.finishedAt ? formatStartedAt(run.finishedAt) : '—'],
    ['Duration', formatDuration(run.durationSeconds)],
    ['Build command', <code key="b">{run.config.buildCommand}</code>],
    ['Test command', <code key="t">{run.config.testCommand}</code>],
    ['Artifacts', `${run.artifactCount} contract artifact${run.artifactCount === 1 ? '' : 's'}`],
  ]
  return (
    <>
      <div className="pr-panel-heading"><h2>Run summary</h2><span className={`pr-status--${run.status}`}>{run.status === 'success' ? 'Completed' : run.status === 'cancelled' ? 'Cancelled' : ''}</span></div>
      <dl className="pr-summary">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <h3 className="pr-summary__heading">Stages</h3>
      <ul className="pr-summary__stages">
        {run.stages.map((item) => (
          <li key={item.key} className={`pr-stage--${item.status}`}>
            <span aria-hidden="true">{STAGE_GLYPH[item.status]}</span> {item.name} — {STAGE_STATUS_LABELS[item.status]}{item.durationSeconds !== null && ` in ${formatDuration(item.durationSeconds)}`}
            {item.skipReason && <span className="pr-summary__reason">{item.skipReason}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}
