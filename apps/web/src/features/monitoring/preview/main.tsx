import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MonitoringPreview } from './MonitoringPreview'

createRoot(document.getElementById('root')!).render(<StrictMode><MonitoringPreview /></StrictMode>)
