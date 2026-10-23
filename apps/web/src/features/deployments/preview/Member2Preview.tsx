import { Member2Page } from '../pages/Member2Pages'
import type { Member2Mode } from '../pages/Member2Pages'
import { createMember2Preview } from '../mocks/member2Preview'

const service = createMember2Preview()
export default function Member2Preview({ mode }: { mode: Member2Mode }) {
  return (
    <>
      <div className="m2-preview-banner">
        Development preview · Sample data · No blockchain transactions are sent.
      </div>
      <Member2Page mode={mode} service={service} base="/preview/member-2" />
    </>
  )
}
