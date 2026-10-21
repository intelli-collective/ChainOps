import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

export function MonitoringDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])
  return <dialog className="monitoring-dialog" ref={ref} aria-labelledby={titleId} onCancel={onClose}>
    <div className="monitoring-section-heading"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">Close ×</button></div>
    {children}
  </dialog>
}
