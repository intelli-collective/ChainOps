import type { RunStatus } from '../types/pipelineRun'
import { RUN_STATUS_LABELS } from '../utils/pipelineRun'

// Status marks are the text glyphs used in the Figma run list.
const GLYPHS: Record<RunStatus, string> = { success: '✓', failed: '✕', cancelled: '○', running: '◉', queued: '○', error: '✕' }

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`pr-status pr-status--${status}`}>
      <span aria-hidden="true">{GLYPHS[status]}</span> {RUN_STATUS_LABELS[status]}
    </span>
  )
}
