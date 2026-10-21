import { DeploymentPage } from './features/deployments'
import { ContractRegistryPage } from './features/contracts'

function App() {
  const registryPath = '/projects/chainvault/contracts'
  const isRegistry = window.location.pathname === registryPath

  return (
    <>
      <header className="deployment-preview-header">
        <strong>ChainOps</strong>
        <nav className="deployment-preview-nav" aria-label="Preview pages">
          <a href="/" aria-current={!isRegistry ? 'page' : undefined}>Deployment</a>
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

export default App
