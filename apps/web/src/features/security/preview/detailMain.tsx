import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DetailPreview } from './DetailPreview'

createRoot(document.getElementById('preview')!).render(<StrictMode><DetailPreview /></StrictMode>)
