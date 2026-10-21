import { DeploymentPage } from './features/deployments'

function App() {
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
      <footer id="deployment-history-preview" className="deployment-preview-footer" tabIndex={-1}>
        Deployment history is not included in this Task 1 preview. All deployment
        actions are simulated; no blockchain transactions are sent.
      </footer>
    </>
  )
}

export default App
