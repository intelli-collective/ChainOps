import { useEffect, useId, useRef, useState } from 'react'
import { formatDateRange } from '../utils/pipelineRun'

interface DateRangeFilterProps {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="pr-daterange" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="pr-control pr-control--button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Date range: ${formatDateRange(from, to)}`}
        onClick={() => setOpen((value) => !value)}
      >
        {formatDateRange(from, to)}
      </button>
      {open && (
        <div id={panelId} className="pr-daterange__panel" role="group" aria-label="Filter by start date">
          <label className="pr-daterange__field">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => onChange({ from: event.target.value, to })} />
          </label>
          <label className="pr-daterange__field">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => onChange({ from, to: event.target.value })} />
          </label>
          <div className="pr-daterange__actions">
            <button type="button" className="pr-text-button" onClick={() => onChange({ from: '', to: '' })}>
              Clear dates
            </button>
            <button type="button" className="pr-text-button" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
