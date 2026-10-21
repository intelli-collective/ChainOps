import { useEffect, useId, useState } from 'react'
import { RunProvenance } from '../components/RunProvenance'
import { StagePanel } from '../components/StagePanel'
import { StageStepper } from '../components/StageStepper'
import { mockPipelineRunService } from '../services/pipelineRunService'
import type { PipelineRunDetails, PipelineRunService, StageKey } from '../types/pipelineRun'
import {
  defaultStage,
  formatDuration,
  formatStartedAt,
  pipelineRunsPath,
  RUN_STATUS_LABELS,
  RUN_TRIGGER_LABELS,
} from '../utils/pipelineRun'
import '../pipelines.css'

interface PipelineRunDetailsPageProps {
  projectId: string
  runId: string
  service?: PipelineRunService
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'ready'; run: PipelineRunDetails }

export function PipelineRunDetailsPage({ projectId, runId, service = mockPipelineRunService }: PipelineRunDetailsPageProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedStage, setSelectedStage] = useState<StageKey | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const panelId = useId()

  useEffect(() => {
    let cancelled = false
    service.getRun(projectId, runId).then(
      (run) => !cancelled && setState(run ? { status: 'ready', run } : { status: 'not-found' }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
    )
    return () => {
      cancelled = true
    }
  }, [projectId, runId, reloadKey, service])

  const retry = () => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }

  const cancelRun = async () => {
    if (state.status !== 'ready') return
    setIsCancelling(true)
    try {
      const run = await service.simulateCancel(state.run)
      setState({ status: 'ready', run })
      setNotice(`Mock run #${run.runNumber} marked as Cancelled. Development data only — no pipeline was stopped.`)
    } catch {
      setNotice('Could not simulate cancelling this run.')
    } finally {
      setIsCancelling(false)
    }
  }

  const run = state.status === 'ready' ? state.run : null
  const stage = run && (run.stages.find((item) => item.key === selectedStage) ?? defaultStage(run.stages))
  const canCancel = run?.status === 'running' || run?.status === 'queued'
  const runLabel = run ? `Pipeline Run #${run.runNumber}` : 'Pipeline Run'

  return (
    <section className="pr-page" aria-labelledby="pipeline-run-title" aria-busy={state.status === 'loading'}>
      <nav aria-label="Breadcrumb" className="pr-breadcrumb">
        <ol>
          <li><a href={pipelineRunsPath(projectId)}>Pipelines</a></li>
          <li aria-current="page">{runLabel}</li>
        </ol>
      </nav>

      <header className="pr-header">
        <div>
          <h1 id="pipeline-run-title" className="pr-title">{runLabel}</h1>
          {run && (
            <p className="pr-subtitle">
              {RUN_TRIGGER_LABELS[run.trigger]} · {RUN_STATUS_LABELS[run.status]}
              <span className="pr-subtitle__meta">
                {' · '}{run.branch} · Started <time dateTime={run.startedAt}>{formatStartedAt(run.startedAt)}</time>
                {run.durationSeconds !== null && ` · ${formatDuration(run.durationSeconds)}`}
              </span>
            </p>
          )}
        </div>
        {canCancel && (
          <button type="button" className="pr-dark-button" onClick={cancelRun} disabled={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel run'}
          </button>
        )}
      </header>

      {notice && (
        <div className="pr-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="pr-text-button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            Dismiss
          </button>
        </div>
      )}

      {state.status === 'loading' && (
        <>
          <div className="pr-provenance"><span className="pr-skeleton pr-skeleton--wide" /></div>
          <div className="pr-stage-card">
            <span className="pr-skeleton pr-skeleton--wide" />
            <span className="pr-skeleton pr-skeleton--title" />
            <span className="pr-skeleton" />
            <span className="pr-skeleton" />
          </div>
        </>
      )}

      {state.status === 'error' && (
        <div className="pr-state" role="alert">
          <p className="pr-state__title">Couldn’t load this pipeline run</p>
          <p className="pr-state__body">{state.message}. Check your connection and try again.</p>
          <button type="button" className="pr-secondary-button" onClick={retry}>Retry</button>
        </div>
      )}

      {state.status === 'not-found' && (
        <div className="pr-state">
          <p className="pr-state__title">Pipeline run not found</p>
          <p className="pr-state__body">This run doesn’t exist in this project, or it may have been removed.</p>
          <a className="pr-secondary-button" href={pipelineRunsPath(projectId)}>Back to pipeline runs</a>
        </div>
      )}

      {run && stage && (
        <>
          <RunProvenance run={run} />
          <div className="pr-stage-card">
            <StageStepper stages={run.stages} selected={stage.key} panelId={panelId} onSelect={setSelectedStage} />
            <StagePanel key={stage.key} id={panelId} stage={stage} />
          </div>
        </>
      )}
    </section>
  )
}
