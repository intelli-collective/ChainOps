import { useResource } from '../../deployments/member2Hooks'
import type { Member2Scope as Scope } from '../../deployments/types/member2'
import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { displayDate, shorten } from '../../deployments/member2Utils'
import {
  AbiViewer,
  PageHeading,
  Panel,
  PinnedContext,
  ResourceState
} from '../../deployments/components/Member2Ui'

export function ContractPage({
  projectId,
  service,
  root,
  id,
  artifactId,
  abiOnly
}: Scope & { id: string; artifactId: string; abiOnly: boolean }) {
  const state = useResource(
    useCallback(async () => {
      if (artifactId) {
        const artifact = (await service.artifacts(projectId)).find(
          (a) => a.id === artifactId
        )
        if (!artifact) throw new Error('Artifact not found or not eligible.')
        return { artifact }
      }
      const contract = await service.contract(projectId, id)
      return { contract, artifact: contract.artifact }
    }, [artifactId, id, projectId, service])
  )
  const navigate = useNavigate()
  const location = useLocation(),
    [selectedTab, setSelectedTab] = useState('Overview'),
    [search, setSearch] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const tab = abiOnly ? 'ABI' : selectedTab
  const contract = state.value?.contract,
    artifact = state.value?.artifact
  const back = artifactId ? `${root}/deployments/new` : `${root}/contracts`
  return (
    <>
      <PageHeading
        title={
          tab === 'ABI'
            ? 'Contract ABI'
            : contract
              ? `${contract.name} ${contract.version}`
              : 'Contract Details'
        }
        subtitle={
          tab === 'ABI'
            ? 'Inspect the published ABI and linked build artifacts.'
            : contract
              ? `${shorten(contract.address)} · ${contract.provenance === 'external' ? 'External registration' : 'Deployed by ChainOps'} · ${contract.network.name}`
              : 'View contract details and deployment evidence.'
        }
        crumb={`Contracts › ${contract?.name ?? artifact?.name ?? 'Contract'}`}
        back={back}
      />
      <ResourceState {...state} />
      {state.value && (
        <>
          {artifact ? (
            <PinnedContext
              artifact={artifact}
              network={contract?.network.name}
            />
          ) : (
            <div className="m2-context">
              External registration · No linked ChainOps build or approval
              evidence
            </div>
          )}
          <div
            className="m2-tabs m2-contract-tabs"
            role="tablist"
            aria-label="Contract navigation"
          >
            {['Overview', 'Activity', 'ABI', 'Versions'].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'm2-primary' : 'm2-secondary'}
                disabled={Boolean(artifactId) && t !== 'ABI'}
                onClick={() => {
                  if (abiOnly && contract)
                    navigate(
                      `${root}/contracts/${id}${t === 'ABI' ? '/abi' : ''}`
                    )
                  else setSelectedTab(t)
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'ABI' ? (
              <Panel
                title={`${artifact?.fileName ?? contract?.name} · ABI`}
                className="m2-abi-panel"
              >
                {artifact ? (
                  <>
                    <input
                      className="m2-abi-search"
                      aria-label="Search ABI"
                      placeholder="Search ABI by function, event, or type…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <AbiViewer
                      abi={artifact.abi.filter(
                        (a) =>
                          !search ||
                          JSON.stringify(a)
                            .toLowerCase()
                            .includes(search.toLowerCase())
                      )}
                    />
                    <Link to={`${root}/pipelines/${artifact.pipelineRunId}`}>
                      Open complete build artifacts →
                    </Link>
                  </>
                ) : (
                  <p className="m2-muted">
                    No published ABI is linked to this external registration.
                  </p>
                )}
              </Panel>
            ) : tab === 'Overview' && contract ? (
              <>
                <div className="m2-columns m2-contract-columns">
                  <Panel
                    title="Contract Details"
                    className="m2-contract-details"
                  >
                    <div className="m2-detail-lines">
                      <p>Name: {contract.name}</p>
                      <p>Version: {contract.version}</p>
                      <p>
                        Network: {contract.network.name} (
                        {contract.network.chainId})
                      </p>
                      <p className="m2-wrap">Address: {contract.address}</p>
                      {artifact?.metadata?.contractType && (
                        <p>Type: {artifact.metadata.contractType}</p>
                      )}
                      <p>Status: {contract.status}</p>
                      <p>
                        {contract.provenance === 'external'
                          ? 'Registered'
                          : 'Deployed'}
                        : {displayDate(contract.createdAt)}
                      </p>
                    </div>
                    <button
                      className="m2-text-button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(contract.address)
                          setCopyMessage('Address copied.')
                        } catch {
                          setCopyMessage(
                            'Unable to copy. Select the address above.'
                          )
                        }
                      }}
                    >
                      Copy address
                    </button>
                    <span role="status">{copyMessage}</span>
                  </Panel>
                  <div className="m2-column-stack">
                    <Panel title="Compiler & Metadata">
                      <div className="m2-detail-lines">
                        <p>Solidity: {artifact?.compiler ?? 'Not supplied'}</p>
                        {artifact?.metadata?.optimizerRuns !== undefined && (
                          <p>
                            Optimizer: Enabled (
                            {artifact.metadata.optimizerRuns} runs)
                          </p>
                        )}
                        {artifact?.metadata?.evm && (
                          <p>EVM: {artifact.metadata.evm}</p>
                        )}
                        {artifact?.metadata?.uri && (
                          <p>Metadata: {artifact.metadata.uri}</p>
                        )}
                        <p>
                          Source: {artifact?.source ?? 'External registration'}
                        </p>
                        {artifact?.metadata?.license && (
                          <p>License: {artifact.metadata.license}</p>
                        )}
                        <p className="m2-wrap">
                          Artifact digest: {artifact?.digest ?? 'Not supplied'}
                        </p>
                        <p>
                          Provenance:{' '}
                          {contract.provenance === 'external'
                            ? 'External registration'
                            : 'ChainOps deployment'}
                        </p>
                        {contract.deploymentId && (
                          <Link
                            to={`${root}/deployments/${contract.deploymentId}/transaction`}
                          >
                            View deployment transaction →
                          </Link>
                        )}
                      </div>
                    </Panel>
                    <Panel>
                      <p className="m2-link-color">
                        Monitoring ·{' '}
                        {contract.monitoring === 'Not enabled' ? '' : '● '}
                        {contract.monitoring}
                      </p>
                      <Link to={`${root}/monitoring`}>
                        View in Monitoring →
                      </Link>
                    </Panel>
                  </div>
                </div>
                <Panel title="Recent Events">
                  <Link
                    className="m2-panel-action"
                    to={`${root}/monitoring/contracts/${contract.id}/events`}
                  >
                    View all events →
                  </Link>
                  <>
                    {contract.recentEvents?.length ? (
                      contract.recentEvents.map((event, i) => (
                        <div className="m2-event-row" key={i}>
                          <span>
                            {new Date(event.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'UTC'
                            })}
                          </span>
                          <Link
                            to={`${root}/monitoring/contracts/${contract.id}/events`}
                          >
                            {event.name}
                          </Link>
                          <span>{event.summary}</span>
                        </div>
                      ))
                    ) : (
                      <p className="m2-muted">
                        Open the event explorer to view monitoring data for this
                        contract.
                      </p>
                    )}
                  </>
                </Panel>
                <Link to={`${root}/deployments/new`}>
                  Prepare optional upgrade →
                </Link>
              </>
            ) : tab === 'Activity' ? (
              <Panel title="Deployment activity">
                {contract?.deploymentId ? (
                  <Link
                    to={`${root}/deployments/${contract.deploymentId}/transaction`}
                  >
                    View transaction status and receipt →
                  </Link>
                ) : (
                  <p className="m2-muted">
                    Registered externally. No ChainOps deployment history is
                    linked.
                  </p>
                )}
              </Panel>
            ) : (
              <Panel title="Versions">
                <p>
                  {contract?.name ?? artifact?.name}{' '}
                  {contract?.version ?? artifact?.version}
                </p>
                {artifact ? (
                  <p className="m2-muted">
                    {artifact.commitSha} · Run #{artifact.runNumber}
                  </p>
                ) : (
                  <p className="m2-muted">External registration</p>
                )}
              </Panel>
            )}
          </div>
          {location.pathname.endsWith('/abi') && contract && (
            <Link to={`${root}/contracts/${id}`}>
              Return to contract overview →
            </Link>
          )}
        </>
      )}
    </>
  )
}
