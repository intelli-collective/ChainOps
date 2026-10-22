import type { PipelineRunDetails } from '../types/pipelineRun'
import { shortSha } from '../utils/pipelineRun'
import { ArrowIcon } from './ArrowIcon'

export function RunProvenance({ run }: { run: PipelineRunDetails }) {
  const items = [
    { label: 'Source', value: shortSha(run.commitSha), title: run.commitSha },
    { label: 'Run', value: `#${run.runNumber}` },
    run.contract && { label: 'Contract', value: `${run.contract.name} ${run.contract.version}` },
    run.network && { label: 'Network', value: run.network },
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
