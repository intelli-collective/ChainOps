import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { DeploymentPage } from './features/deployments'
import './App.css'

function DeploymentPreview() {
  return (
    <>
      <header className="deployment-preview-header">
        <strong>ChainOps</strong>
        <span>Task 1 · Deployment preview · Mock data</span>
      </header>

      <DeploymentPage
        projectId="chainvault"
        historyHref="#deployment-history-preview"
      />

      <footer
        id="deployment-history-preview"
        className="deployment-preview-footer"
        tabIndex={-1}
      >
        Deployment history is not included in this Task 1 preview. All deployment
        actions are simulated; no blockchain transactions are sent.
      </footer>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/deployments" element={<DeploymentPreview />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}