import { useRef, type KeyboardEvent } from 'react'
import type { PipelineStage, StageKey, StageStatus } from '../types/pipelineRun'
import { STAGE_STATUS_LABELS, stageTabId } from '../utils/pipelineRun'
import { ArrowIcon } from './ArrowIcon'

// Stage marks are the text glyphs used in the Figma run frames.
const GLYPHS: Record<StageStatus, string> = { success: '✓', failed: '✕', running: '◉', cancelled: '⊘', pending: '○', skipped: '○' }

function StageIcon({ status }: { status: StageStatus }) {
  return <span aria-hidden="true">{GLYPHS[status]}</span>
}

interface StageStepperProps {
  stages: PipelineStage[]
  selected: StageKey
  panelId: string
  onSelect: (key: StageKey) => void
}

export function StageStepper({ stages, selected, panelId, onSelect }: StageStepperProps) {
  const tabRefs = useRef(new Map<StageKey, HTMLButtonElement>())

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next: number | undefined
    if (event.key in offsets) next = (index + offsets[event.key] + stages.length) % stages.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = stages.length - 1
    if (next === undefined) return
    event.preventDefault()
    const key = stages[next].key
    onSelect(key)
    tabRefs.current.get(key)?.focus()
  }

  return (
    <ol className="pr-stepper" role="tablist" aria-label="Pipeline stages">
      {stages.map((stage, index) => (
        <li key={stage.key} className="pr-stepper__item" role="presentation">
          <button
            ref={(node) => {
              if (node) tabRefs.current.set(stage.key, node)
              else tabRefs.current.delete(stage.key)
            }}
            id={stageTabId(stage.key)}
            type="button"
            role="tab"
            aria-selected={stage.key === selected}
            aria-controls={panelId}
            aria-label={`${stage.name}: ${STAGE_STATUS_LABELS[stage.status]}`}
            tabIndex={stage.key === selected ? 0 : -1}
            className={`pr-stepper__tab pr-stage--${stage.status}`}
            onClick={() => onSelect(stage.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <StageIcon status={stage.status} />
            {stage.name}
          </button>
          {index < stages.length - 1 && <ArrowIcon className="pr-stepper__arrow" />}
        </li>
      ))}
    </ol>
  )
}
