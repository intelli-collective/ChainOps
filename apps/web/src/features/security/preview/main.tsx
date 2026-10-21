import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

if (import.meta.env.DEV) {
  const { Preview } = await import('./Preview')
  const root = document.getElementById('preview')
  if (root) createRoot(root).render(<StrictMode><Preview /></StrictMode>)
}
