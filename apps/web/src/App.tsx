import { lazy, Suspense } from 'react'
import { Member2Page } from './features/deployments/pages/Member2Pages'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AuthPage } from './features/auth/AuthPage'
import { ProtectedRoutes, VerifyEmail } from './features/auth/Session'
import { RecoveryPage } from './features/auth/RecoveryPage'
import { LandingPage } from './features/landing/LandingPage'
import { PipelineRunsPage } from './features/pipelines'
import { MonitoringWorkspace } from './features/monitoring'
import { SecurityDashboard } from './features/security'
import { createMockSecurityService } from './features/security/services/mockSecurityService'
import { DashboardPlaceholder } from './app/DashboardPlaceholder'
import { ApplicationLayout } from './app/layouts/ApplicationLayout'
import { RoutePlaceholder } from './app/RoutePlaceholder'
import './App.css'

const securityService = createMockSecurityService()

const Member2Preview = import.meta.env.DEV
  ? lazy(() => import('./features/deployments/preview/Member2Preview'))
  : () => null

function ProjectPage({
  page,
}: {
  page:
    | 'pipelines'
    | 'deployments'
    | 'contracts'
    | 'monitoring'
    | 'events'
    | 'security'
}) {
  const { projectId = 'chainvault', contractId } = useParams()
  const navigate = useNavigate()

  switch (page) {
    case 'pipelines':
      return <PipelineRunsPage key={projectId} projectId={projectId} />

    case 'deployments':
      return (
        <DeploymentPage
          key={projectId}
          projectId={projectId}
          historyHref={`/projects/${encodeURIComponent(projectId)}/deployments`}
        />
      )

    case 'contracts':
      return <ContractRegistryPage key={projectId} projectId={projectId} />

    case 'monitoring':
      return (
        <MonitoringWorkspace
          key={projectId}
        />
      )

    case 'events':
      return (
        <ContractEventsExplorer
          projectId={projectId}
          contractId={contractId}
          onBackToMonitoring={() =>
            navigate(
              `/projects/${encodeURIComponent(projectId)}/monitoring`,
            )
          }
        />
      )

    case 'security':
      return (
        <SecurityDashboard
          projectId={projectId}
          service={securityService}
          onNavigate={navigate}
        />
      )
  }
}