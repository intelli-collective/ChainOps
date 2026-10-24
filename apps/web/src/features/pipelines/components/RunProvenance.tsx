import type { PipelineRunDetails } from '../types/pipelineRun'
import { shortSha } from '../utils/pipelineRun'
import { ArrowIcon } from './ArrowIcon'

/** Commit → run → artifact traceability strip. */
export function RunProvenance({ run }: { run: Pick<PipelineRunDetails, 'commitSha' | 'runNumber' | 'repository' | 'contracts'> }) {
  const items = [
    { label: 'Source', value: shortSha(run.commitSha), title: `${run.repository}@${run.commitSha}` },
    { label: 'Run', value: `#${run.runNumber}` },
    run.contracts.length > 0 && { label: run.contracts.length > 1 ? 'Contracts' : 'Contract', value: run.contracts.join(', ') },
    { label: 'Repository', value: run.repository },
  ].filter((item) => !!item)

  return (
    <ol className="pr-provenance" aria-label="Run provenance">
      {items.map((item, index) => (
        <li key={item.label} className="pr-provenance__item">
          <span>{item.label}</span>
          <span title={'title' in item ? item.title : undefined}>{item.value}</span>
          {index < items.length - 1 && <ArrowIcon className="pr-provenance__arrow" />}
        </li>
      ))}
    </ol>
  )
}
