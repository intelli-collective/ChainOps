import { useParams } from 'react-router-dom'
import type { Member2Service } from '../types/member2'
import { member2Api } from '../services/member2Api'
import { DeploymentHistory } from './DeploymentHistoryPage'
import { DeploymentWizard } from './DeploymentWizardPage'
import { TransactionPage } from './DeploymentTransactionPage'
import { RegistryPage } from '../../contracts/pages/Member2RegistryPage'
import { RegisterPage } from '../../contracts/pages/Member2RegisterPage'
import { ContractPage } from '../../contracts/pages/Member2ContractPage'
import '../member2.css'

export type Member2Mode =
  | 'history'
  | 'wizard'
  | 'outcome'
  | 'transaction'
  | 'registry'
  | 'register'
  | 'contract'
  | 'abi'
interface Props {
  mode: Member2Mode
  service?: Member2Service
  base?: string
}
export function Member2Page({ mode, service = member2Api, base }: Props) {
  const {
    projectId = 'chainvault',
    deploymentId = '',
    contractId = '',
    artifactId = ''
  } = useParams()
  const root = base ?? `/projects/${encodeURIComponent(projectId)}`
  const props = { projectId, service, root }
  return (
    <div className="m2-page">
      {mode === 'history' && <DeploymentHistory {...props} />}
      {mode === 'wizard' && <DeploymentWizard {...props} />}
      {(mode === 'outcome' || mode === 'transaction') && (
        <TransactionPage
          key={deploymentId}
          {...props}
          id={deploymentId}
          detail={mode === 'transaction'}
        />
      )}
      {mode === 'registry' && <RegistryPage {...props} />}
      {mode === 'register' && <RegisterPage {...props} />}
      {(mode === 'contract' || mode === 'abi') && (
        <ContractPage
          key={`${contractId}:${artifactId}:${mode}`}
          {...props}
          id={contractId}
          artifactId={artifactId}
          abiOnly={mode === 'abi'}
        />
      )}
    </div>
  )
}
