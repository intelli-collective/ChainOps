import { lazy, Suspense } from 'react'
import { Member2Page } from './features/deployments/pages/Member2Pages'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { ProtectedRoutes, VerifyEmail } from './features/auth/Session'
import { RecoveryPage } from './features/auth/RecoveryPage'
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
const Member2Preview = import.meta.env.DEV ? lazy(() => import('./features/deployments/preview/Member2Preview')) : () => null
function ProjectPage({ page }: { page: 'pipelines' | 'deployments' | 'contracts' | 'monitoring' | 'events' | 'security' }) {
  const { projectId = 'chainvault', contractId } = useParams()
  const navigate = useNavigate()
  switch (page) {
    case 'pipelines': return <PipelineRunsPage key={projectId} projectId={projectId} />
    case 'deployments': return <Member2Page mode="wizard" />
    case 'contracts': return <Member2Page mode="registry" />
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
    {import.meta.env.DEV && <Route element={<ApplicationLayout preview />}>
      <Route path="/preview/member-2" element={<Navigate to="/preview/member-2/deployments" replace />} />
      {([['deployments','history'],['deployments/new','wizard'],['deployments/:deploymentId','outcome'],['deployments/:deploymentId/transaction','transaction'],['contracts','registry'],['contracts/register','register'],['contracts/:contractId','contract'],['contracts/:contractId/abi','abi'],['artifacts/:artifactId/abi','abi'],['smart-contracts','registry']] as const).map(([path,mode]) => <Route key={path} path={`/preview/member-2/${path}`} element={<Suspense fallback={<p role="status">Loading preview…</p>}><Member2Preview mode={mode} /></Suspense>} />)}
      <Route path="/preview/member-2/*" element={<RoutePlaceholder title="Shared module integration" />} />
    </Route>}
    <Route element={<ProtectedRoutes />}>
    <Route element={<ApplicationLayout />}>
      <Route path="/dashboard" element={<DashboardPlaceholder />} />
      <Route path="/onboarding" element={<DashboardPlaceholder />} />
      <Route path="/projects" element={<RoutePlaceholder title="Projects" />} />
      <Route path="/projects/:projectId/pipelines" element={<ProjectPage page="pipelines" />} />
      <Route path="/projects/:projectId/pipelines/:runId" element={<RoutePlaceholder title="Pipeline run details" back="pipelines" />} />
      <Route path="/projects/:projectId/deployments/new" element={<ProjectPage page="deployments" />} />
      <Route path="/projects/:projectId/deployments" element={<Member2Page mode="history" />} />
      <Route path="/projects/:projectId/deployments/:deploymentId" element={<Member2Page key="outcome" mode="outcome" />} />
      <Route path="/projects/:projectId/deployments/:deploymentId/transaction" element={<Member2Page key="transaction" mode="transaction" />} />
      <Route path="/projects/:projectId/contracts/register" element={<Member2Page mode="register" />} />
      <Route path="/projects/:projectId/contracts/:contractId" element={<Member2Page mode="contract" />} />
      <Route path="/projects/:projectId/contracts/:contractId/abi" element={<Member2Page mode="abi" />} />
      <Route path="/projects/:projectId/artifacts/:artifactId/abi" element={<Member2Page mode="abi" />} />
      <Route path="/projects/:projectId/smart-contracts" element={<Member2Page mode="registry" />} />
      <Route path="/projects/:projectId/contracts" element={<ProjectPage page="contracts" />} />
      <Route path="/projects/:projectId/monitoring" element={<ProjectPage page="monitoring" />} />
      <Route path="/projects/:projectId/monitoring/contracts/:contractId/events" element={<ProjectPage page="events" />} />
      <Route path="/projects/:projectId/security" element={<ProjectPage page="security" />} />
      <Route path="/projects/:projectId/security/scans/:scanId" element={<RoutePlaceholder title="Security scan details" back="security" />} />
      <Route path="/alerts" element={<RoutePlaceholder title="Alerts" />} />
      <Route path="/audit" element={<RoutePlaceholder title="Audit" />} />
      <Route path="/settings" element={<RoutePlaceholder title="Settings" />} />
      <Route path="/deployments" element={<Navigate to="/projects/chainvault/deployments" replace />} />
      <Route path="*" element={<RoutePlaceholder title="Page not found" />} />
    </Route>
    </Route>
  </Routes></BrowserRouter>
}
