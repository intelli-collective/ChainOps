import type { RunStatus } from '../types/pipelineRun'
import { RUN_STATUS_LABELS } from '../utils/pipelineRun'

function StatusIcon({ status }: { status: RunStatus }) {
  const common = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }
  switch (status) {
    case 'success':
      return <svg {...common}><path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'failed':
      return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
    case 'cancelled':
      return <svg {...common}><circle cx="8" cy="8" r="5.5" /></svg>
    case 'running':
      return <svg {...common} className="pr-status__spinner"><path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" strokeLinecap="round" /></svg>
    case 'queued':
      return <svg {...common}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" strokeLinecap="round" /></svg>
  }
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`pr-status pr-status--${status}`}>
      <StatusIcon status={status} />
      {RUN_STATUS_LABELS[status]}
    </span>
  )
}
