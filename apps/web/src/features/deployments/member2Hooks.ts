import { useEffect, useState } from 'react'

export function useResource<T>(read: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    source?: () => Promise<T>
    value?: T
    error?: string
    loading: boolean
  }>({ loading: true })
  useEffect(() => {
    let active = true
    read()
      .then((value) => {
        if (active) setState({ source: read, value, loading: false })
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            source: read,
            error:
              error instanceof Error ? error.message : 'Unable to load data.',
            loading: false
          })
      })
    return () => {
      active = false
    }
  }, [read, attempt])
  return {
    ...(state.source === read ? state : { loading: true }),
    reload: () => {
      setState({ loading: true })
      setAttempt((a) => a + 1)
    }
  }
}
