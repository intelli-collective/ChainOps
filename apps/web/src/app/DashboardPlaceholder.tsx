import { Link } from 'react-router-dom'

// Dashboard placeholder only: workspace provisioning belongs to a later feature.
export function DashboardPlaceholder() {
  return <section className="workspace-placeholder">
    <h1>Set up your workspace</h1>
    <p>Get your team and first project ready in a few steps.</p>
    <div className="workspace-columns">
      <ol className="workspace-steps">
        <li aria-current="step"><strong>1&nbsp; Organization</strong><p>Set your organization details</p></li>
        <li><strong>2&nbsp; Create project</strong><p>Configure your first project</p></li>
        <li><strong>3&nbsp; Choose network</strong><p>Select a development network</p></li>
      </ol>
      <section className="workspace-panel" aria-labelledby="organization-title">
        <h2 id="organization-title">Organization details</h2>
        <label htmlFor="organization-name">Organization name</label>
        <input id="organization-name" name="organizationName" defaultValue="ChainOps Team" />
        <label htmlFor="organization-slug">Organization slug</label>
        <input id="organization-slug" name="organizationSlug" defaultValue="chainops-team" />
        <label htmlFor="team-size">Team size (optional)</label>
        <select id="team-size" defaultValue="1"><option value="1">Just me</option><option value="2-10">2–10</option><option value="11-50">11–50</option><option value="51+">51+</option></select>
        <div className="workspace-actions"><Link to="/login">← Back</Link><Link to="/projects">Continue →</Link></div>
      </section>
    </div>
  </section>
}
