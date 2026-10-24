import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; code: number }
  | { status: 'ready'; data: T }

/** Loads data for a page; `reload` refetches and `replace` swaps in data returned by a mutation. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })
  const [key, setKey] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    let active = true
    loadRef.current().then(
      (data) => { if (active) setState({ status: 'ready', data }) },
      (error: unknown) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong', code: error instanceof ApiError ? error.status : 0 })
      },
    )
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key])
  const reload = useCallback(() => { setState({ status: 'loading' }); setKey((value) => value + 1) }, [])
  const refresh = useCallback(() => setKey((value) => value + 1), [])
  const replace = useCallback((data: T) => setState({ status: 'ready', data }), [])
  return { state, reload, refresh, replace }
}
