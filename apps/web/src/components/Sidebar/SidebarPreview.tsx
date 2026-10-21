import { Sidebar } from './Sidebar'
import type { SidebarGroup, SidebarIconName } from './Sidebar'

const previewGroups: SidebarGroup[] = [
  { label: 'Build', items: ['Projects', 'Pipelines', 'Security'].map(item) },
  { label: 'Release', items: ['Approvals', 'Deployments', 'Contracts'].map(item) },
  { label: 'Operate', items: ['Monitoring', 'Alerts', 'Audit', 'Settings'].map(item) },
]

function item(label: string) {
  const icon = label.toLowerCase() as SidebarIconName
  return { label, icon, to: `/sidebar-preview/${icon}` }
}

export function SidebarPreview() {
  return <div style={{ display: 'flex', minHeight: '100svh', background: '#000' }}>
    <Sidebar projectId="chainvault" groups={previewGroups} brandHref="/sidebar-preview/contracts" />
  </div>
}
