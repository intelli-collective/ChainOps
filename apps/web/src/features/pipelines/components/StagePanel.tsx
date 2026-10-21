import { useId, useState } from 'react'
import type { PipelineStage } from '../types/pipelineRun'
import { formatDuration, stageHeading, stageTabId } from '../utils/pipelineRun'

/** Number of trailing log lines shown while the log is collapsed. */
const COLLAPSED_LINES = 3

interface StagePanelProps {
  id: string
  stage: PipelineStage
}

export function StagePanel({ id, stage }: StagePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const logId = useId()
  const canExpand = stage.logs.length > COLLAPSED_LINES
  const visibleLogs = expanded || !canExpand ? stage.logs : stage.logs.slice(-COLLAPSED_LINES)

  return (
    <div id={id} role="tabpanel" aria-labelledby={stageTabId(stage.key)} className="pr-stage-panel">
      <h2 className="pr-stage-panel__title">{stageHeading(stage)}</h2>
      {stage.durationSeconds !== null && (
        <p className="pr-stage-panel__meta">Duration {formatDuration(stage.durationSeconds)}</p>
      )}

      {stage.error && (
        <div className="pr-stage-error" role="alert">
          <p className="pr-stage-error__message">{stage.error.message}</p>
          {stage.error.detail && <pre className="pr-stage-error__detail">{stage.error.detail}</pre>}
        </div>
      )}

      {stage.logs.length > 0 ? (
        <>
          <pre id={logId} className="pr-log" aria-label={`${stage.name} log`}>
            {visibleLogs.join('\n')}
          </pre>
          {canExpand && (
            <button type="button" className="pr-text-button pr-log__toggle" aria-expanded={expanded} aria-controls={logId} onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show fewer lines' : `Show full log (${stage.logs.length} lines)`}
            </button>
          )}
        </>
      ) : (
        <p className="pr-stage-panel__empty">
          {stage.status === 'skipped' ? 'This stage did not run.' : 'No log output yet. This stage starts after the previous stages finish.'}
        </p>
      )}
    </div>
  )
}
