import type { PipelineStage } from '../types/pipelineRun'
import { formatDuration, stageHeading, stageTabId } from '../utils/pipelineRun'
import { LogViewer } from './PageChrome'

/** The selected stage: heading, failure reason and its plain-text log. */
export function StagePanel({ id, stage, live }: { id: string; stage: PipelineStage; live?: boolean }) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={stageTabId(stage.key)} className="pr-stage-panel">
      <h2 className="pr-stage-panel__title">{stageHeading(stage)}</h2>
      {stage.durationSeconds !== null && <p className="pr-stage-panel__meta">Duration {formatDuration(stage.durationSeconds)}</p>}
      {stage.error && (
        <div className="pr-stage-error" role="alert">
          <p className="pr-stage-error__message">{stage.error.message}</p>
        </div>
      )}
      {stage.skipReason && <p className="pr-stage-panel__meta">{stage.skipReason}</p>}
      <LogViewer
        lines={stage.logs}
        label={`${stage.name} log`}
        live={live}
        empty={stage.status === 'skipped' ? 'This stage did not run.' : stage.status === 'pending' ? 'No output yet. This stage starts after the previous stages finish.' : 'No output.'}
      />
    </div>
  )
}
