import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { DeploymentPage } from './features/deployments'
import { ContractRegistryPage } from './features/contracts'
import { SidebarPreview } from './components/Sidebar/SidebarPreview'
import './App.css'

const registryPath = '/projects/chainvault/contracts'

function DeploymentPreview() {
  const isRegistry = useLocation().pathname === registryPath

  return (
    <>
      <header className="deployment-preview-header">
        <strong>ChainOps</strong>
        <nav className="deployment-preview-nav" aria-label="Preview pages">
          <a href="/deployments" aria-current={!isRegistry ? 'page' : undefined}>Deployment</a>
          <a href={registryPath} aria-current={isRegistry ? 'page' : undefined}>Contract Registry</a>
        </nav>
        <span>Member 2 preview · Mock data</span>
      </header>
      {isRegistry ? <ContractRegistryPage projectId="chainvault" /> : <DeploymentPage
        projectId="chainvault"
        historyHref="#deployment-history-preview"
      />}
      <footer id="deployment-history-preview" className="deployment-preview-footer" tabIndex={-1}>
        This preview uses mock data. No blockchain transactions are sent, and local
        registry additions reset when the page reloads.
      </footer>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sidebar-preview" element={<Navigate to="/sidebar-preview/contracts" replace />} />
        <Route path="/sidebar-preview/*" element={<SidebarPreview />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/deployments" element={<DeploymentPreview />} />
        <Route path={registryPath} element={<DeploymentPreview />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
