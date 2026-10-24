import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, pipelineApi } from '../services/pipelineApi'
import type { ProjectSummary } from '../types/pipelineRun'

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; code: number }
  | { status: 'ready'; data: T }

const errorState = (error: unknown): Loadable<never> => ({
  status: 'error',
  message: error instanceof Error ? error.message : 'Something went wrong',
  code: error instanceof ApiError ? error.status : 0,
})

/**
 * Loads data and optionally refreshes it while `poll` is true (e.g. a run is still
 * executing). Polling stops when the page is hidden or `poll` becomes false.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], options: { poll?: (data: T) => boolean; intervalMs?: number } = {}) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const loadRef = useRef(load)
  const pollRef = useRef(options.poll)
  useEffect(() => {
    loadRef.current = load
    pollRef.current = options.poll
  })

  useEffect(() => {
    let active = true
    let timer: number | undefined
    const run = async (initial: boolean) => {
      try {
        const data = await loadRef.current()
        if (!active) return
        setState({ status: 'ready', data })
        if (pollRef.current?.(data)) timer = window.setTimeout(() => { if (document.visibilityState === 'visible') void run(false); else timer = window.setTimeout(() => void run(false), 3000) }, options.intervalMs ?? 3000)
      } catch (error) {
        // Keep showing the last good data if a background refresh fails.
        if (active && initial) setState(errorState(error))
        else if (active) timer = window.setTimeout(() => void run(false), (options.intervalMs ?? 3000) * 2)
      }
    }
    void run(true)
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  const reload = useCallback(() => { setState({ status: 'loading' }); setReloadKey((key) => key + 1) }, [])
  const replace = useCallback((data: T) => setState({ status: 'ready', data }), [])
  return { state, reload, replace }
}

const projects = new Map<string, Promise<ProjectSummary>>()

/** Resolves a route project reference (slug such as "chainvault", or UUID) to the project. */
export function useProject(ref: string) {
  return useLoad(() => {
    let pending = projects.get(ref)
    if (!pending) {
      pending = pipelineApi.lookupProject(ref)
      projects.set(ref, pending)
      pending.catch(() => projects.delete(ref))
    }
    return pending
  }, [ref])
}
