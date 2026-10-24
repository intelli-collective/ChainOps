# Task 1 pull request guide

Task: **M3-FE-01 — Implement Contract Monitoring Dashboard**  
Target branch: **dev**  
PR title: **feat(m3): add contract monitoring dashboard**

Follow the repository's `CONTRIBUTING.md`. Replace placeholders with actual issue/design references before publishing.

## 1. Create or locate the Task 1 issue

Use a dedicated issue for M3-FE-01. Include:

- Route: `/projects/:projectId/monitoring`.
- The approved monitoring screenshot supplied for this task; add the exact Figma frame URL if available.
- Dashboard requirements, mock interactions, and acceptance criteria.
- M5 dependency for shared shell, design tokens, and route registration.

Assign the issue to yourself and set its project status to **In Progress**.

## 2. Prepare a branch containing only Task 1

**Current state:** commit `730ff4b` includes both the dashboard and Events Explorer. Some required files, including types, CSS, and the dialog component, are still untracked. Opening a PR directly from the current branch would include both tasks and omit required dependencies.

Use a separate worktree to prepare Task 1 without altering your current branch or uncommitted work. Run the following from the `ChainOps` repository root in PowerShell:

```powershell
$sourceRepo = (Get-Location).Path
$issueNumber = Read-Host 'Enter the actual Task 1 GitHub issue number'
if ($issueNumber -notmatch '^\d+$') { throw 'Enter a numeric issue number.' }
$taskBranch = "feat/issue-$issueNumber-monitoring-dashboard"
$taskRepo = Join-Path (Split-Path $sourceRepo -Parent) 'ChainOps-task1'

git fetch origin
git worktree add -b $taskBranch $taskRepo origin/dev
```

Continue only if those commands succeed. If `ChainOps-task1` already exists, choose a different unused directory name. Keep your current worktree intact.

Copy only the dashboard's files, including its currently untracked dependencies:

```powershell
$feature = 'apps/web/src/features/monitoring'
$task1Files = @(
  'types.ts',
  'monitoring.css',
  'components/MonitoringDialog.tsx',
  'mocks/monitoring.ts',
  'services/monitoringService.ts',
  'pages/MonitoringDashboard.tsx',
  'preview/index.html',
  'preview/main.tsx',
  'review/verify.mjs',
  'review/desktop.png',
  'review/mobile.png'
)
foreach ($file in $task1Files) {
  $sourceFile = Join-Path (Join-Path $sourceRepo $feature) $file
  $targetFile = Join-Path (Join-Path $taskRepo $feature) $file
  New-Item -ItemType Directory -Force -Path (Split-Path $targetFile -Parent) | Out-Null
  Copy-Item -LiteralPath $sourceFile -Destination $targetFile
}
Set-Location -LiteralPath $taskRepo
```

Do **not** copy `events/`, `ContractEventsExplorer.tsx`, the combined preview component, the combined exports, or Task 2's screenshots/scripts.

Create Task 1-only exports and a dashboard preview:

```powershell
@'
export { MonitoringDashboard } from './pages/MonitoringDashboard'
export { createMockMonitoringService, mockMonitoringService } from './services/monitoringService'
export type { MonitoringService } from './services/monitoringService'
export type { MonitoringSnapshot, TimeRange } from './types'
'@ | Set-Content -Encoding utf8 -LiteralPath "$feature/index.ts"

@'
import { useMemo, useState } from 'react'
import { MonitoringDashboard } from '../pages/MonitoringDashboard'
import { createMockMonitoringService } from '../services/monitoringService'
import type { MockScenario } from '../types'

export function MonitoringPreview() {
  const [scenario, setScenario] = useState<MockScenario>('success')
  const service = useMemo(() => createMockMonitoringService(scenario), [scenario])
  return <>
    <aside className="preview-controls" aria-label="Development preview controls">
      <span>M3-FE-01 · Feature preview</span>
      <label>Data state<select value={scenario} onChange={event => setScenario(event.target.value as MockScenario)}>
        <option value="success">Success</option>
        <option value="empty">Empty</option>
        <option value="error">Error</option>
      </select></label>
      <a href="/">Back to app</a>
    </aside>
    <MonitoringDashboard key={scenario} projectId="chainvault" service={service} />
  </>
}
'@ | Set-Content -Encoding utf8 -LiteralPath "$feature/preview/MonitoringPreview.tsx"
```

These commands are instructions; the isolated branch/worktree has not been created automatically. If latest `dev` now has shared components or tokens, reconcile the dashboard with those before committing.

## 3. Run checks and review the dashboard

In the new worktree:

```powershell
npm.cmd ci
npm.cmd run build -w apps/web
npm.cmd run lint -w apps/web
npm.cmd run dev -w apps/web -- --host 127.0.0.1
```

Open the preview path at the port Vite prints:

```text
http://127.0.0.1:5173/src/features/monitoring/preview/index.html
```

If the original worktree's Vite server is already using port 5173, stop it before running the isolated preview. The automated review script expects port 5173.

Check time-range changes, contract event inspection, watcher preferences, alert summaries, loading/empty/error states, keyboard dialogs, and desktop/mobile layouts. Run `review/verify.mjs` if the dedicated debug Chrome instance is available, as described in the existing monitoring README. Refresh screenshots from the Task 1-only preview before attaching them; the current screenshots show the combined preview toolbar.

The previous working-tree checks passed, but this isolated branch must be checked separately. Do not describe unrun checks as passing.

## 4. Stage and commit only Task 1

```powershell
git status --short
git add -- apps/web/src/features/monitoring
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Confirm the staged files contain the dashboard and its dependencies only. Then:

```powershell
git commit -m "feat(m3): add contract monitoring dashboard"
git push -u origin $taskBranch
```

## 5. Open the pull request on GitHub

1. Open the repository's **Pull requests** tab and select **New pull request**.
2. Set **base** to `dev`.
3. Set **compare** to `feat/issue-<actual-number>-monitoring-dashboard`.
4. Inspect **Files changed** to confirm Task 2 is excluded.
5. Use the title and description below. Replace every placeholder.

**Title**

```text
feat(m3): add contract monitoring dashboard
```

**Description**

```markdown
## Summary

Implements M3-FE-01's Contract Monitoring Dashboard using the approved screenshot and typed mock data.

## Changes

- Add watcher health, event rate, indexed block, and throughput summaries.
- Add time-range selection, monitored contracts, latest events, and recent alert summaries.
- Add contract event inspection and in-memory watcher preferences.
- Add loading, empty, error/retry, responsive, and accessible dialog states.
- Provide an isolated feature preview and browser verification script.

## Design

- Reference: [attach the approved monitoring screenshot].
- Exact Figma frame URL: [add if available; otherwise state it was not supplied].
- Desktop/mobile results: [attach screenshots from this branch].

## Validation

- Build: [result of npm.cmd run build -w apps/web].
- Lint: [result of npm.cmd run lint -w apps/web].
- Browser/manual checks: [record the checks actually performed].

## Integration notes

All telemetry and interactions are mocked. Watcher preferences are session-only.
M5 must register /projects/:projectId/monitoring and supply the shared shell/tokens.
The full Events Explorer is handled separately in M3-FE-02.

## Checklist

- [ ] Changes reviewed locally
- [ ] Relevant documentation and verification assets updated
- [ ] No secrets or unrelated files included
- [ ] Task 2 excluded
- [ ] Design reference and comparison screenshots attached

Refs #ACTUAL_TASK_1_ISSUE_NUMBER
```

Use `Refs` while route registration/design review or other issue acceptance criteria remain pending. Change to `Closes #<actual-number>` only when the PR fully completes the issue. A merge into `dev` may not auto-close it if `dev` is not the repository's default branch.

## 6. Request review and update the issue

- Request at least one other team member's review; involve M5 for integration.
- Move the **issue** to **In Review** in GitHub Projects.
- Resolve review feedback before merging.
- After approval, prefer **Squash and Merge** into `dev`.
- Move the issue to **Done** when accepted, merged, and complete; close it manually if needed.

Do not merge directly into `main` or push feature changes directly to `dev`.
