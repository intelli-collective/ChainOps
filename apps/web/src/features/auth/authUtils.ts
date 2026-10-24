import { useEffect, useState } from 'react'

export function passwordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 128) return 'Password must be at most 128 characters.'
}

// Keep email tokens only in component memory and remove them from history.
export function useEmailToken(path: string) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'))
  useEffect(() => { window.history.replaceState(window.history.state, '', path) }, [path])
  return token
}
