import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { ProtectedRoutes, VerifyEmail } from './features/auth/Session'
import { RecoveryPage } from './features/auth/RecoveryPage'
import { DeploymentPage } from './features/deployments'
import { ContractRegistryPage } from './features/contracts'
import { LandingPage } from './features/landing/LandingPage'
import { PipelineRunsPage } from './features/pipelines'
import { MonitoringDashboard, ContractEventsExplorer } from './features/monitoring'
import { SecurityDashboard } from './features/security'
import { createMockSecurityService } from './features/security/services/mockSecurityService'
import { DashboardPlaceholder } from './app/DashboardPlaceholder'
import { ApplicationLayout } from './app/layouts/ApplicationLayout'
import { RoutePlaceholder } from './app/RoutePlaceholder'
import './App.css'

const securityService = createMockSecurityService()
function ProjectPage({ page }: { page: 'pipelines' | 'deployments' | 'contracts' | 'monitoring' | 'events' | 'security' }) {
  const { projectId = 'chainvault', contractId } = useParams()
  const navigate = useNavigate()
  switch (page) {
    case 'pipelines': return <PipelineRunsPage key={projectId} projectId={projectId} />
    case 'deployments': return <DeploymentPage key={projectId} projectId={projectId} historyHref={`/projects/${encodeURIComponent(projectId)}/deployments`} />
    case 'contracts': return <ContractRegistryPage key={projectId} projectId={projectId} />
    case 'monitoring': return <MonitoringDashboard key={projectId} projectId={projectId} onOpenEventExplorer={navigate} />
    case 'events': return <ContractEventsExplorer projectId={projectId} contractId={contractId} onBackToMonitoring={() => navigate(`/projects/${encodeURIComponent(projectId)}/monitoring`)} />
    case 'security': return <SecurityDashboard projectId={projectId} service={securityService} onNavigate={navigate} />
  }
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/forgot-password" element={<RecoveryPage mode="forgot" />} />
    <Route path="/reset-password" element={<RecoveryPage mode="reset" />} />
    <Route element={<ProtectedRoutes />}>
    <Route element={<ApplicationLayout />}>
      <Route path="/dashboard" element={<DashboardPlaceholder />} />
      <Route path="/onboarding" element={<DashboardPlaceholder />} />
      <Route path="/projects" element={<RoutePlaceholder title="Projects" />} />
      <Route path="/projects/:projectId/pipelines" element={<ProjectPage page="pipelines" />} />
      <Route path="/projects/:projectId/pipelines/:runId" element={<RoutePlaceholder title="Pipeline run details" back="pipelines" />} />
      <Route path="/projects/:projectId/deployments/new" element={<ProjectPage page="deployments" />} />
      <Route path="/projects/:projectId/deployments" element={<RoutePlaceholder title="Deployments" />} />
      <Route path="/projects/:projectId/contracts" element={<ProjectPage page="contracts" />} />
      <Route path="/projects/:projectId/monitoring" element={<ProjectPage page="monitoring" />} />
      <Route path="/projects/:projectId/monitoring/contracts/:contractId/events" element={<ProjectPage page="events" />} />
      <Route path="/projects/:projectId/security" element={<ProjectPage page="security" />} />
      <Route path="/projects/:projectId/security/scans/:scanId" element={<RoutePlaceholder title="Security scan details" back="security" />} />
      <Route path="/alerts" element={<RoutePlaceholder title="Alerts" />} />
      <Route path="/audit" element={<RoutePlaceholder title="Audit" />} />
      <Route path="/settings" element={<RoutePlaceholder title="Settings" />} />
      <Route path="/deployments" element={<Navigate to="/projects/chainvault/deployments/new" replace />} />
      <Route path="*" element={<RoutePlaceholder title="Page not found" />} />
    </Route>
    </Route>
  </Routes></BrowserRouter>
}
