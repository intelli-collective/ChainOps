# Member 3 · Monitoring frontend

Task 1's dashboard and Task 2's Contract Events Explorer are implemented as isolated features. See [Task 2 behavior and integration notes](events/README.md).

Implements Member 3's first frontend sprint task using the screenshot supplied in the task conversation. An exact Figma frame URL and responsive variants were not supplied; no frame URL has been invented. The page content follows the supplied desktop reference. Mobile layouts stack the same cards.

All changes stay in `src/features/monitoring/`. The existing app entry point, shared shell, router, package manifests, lockfiles, and global styles are unchanged. No dependencies were added. The feature uses scoped plain CSS because Tailwind and shared design tokens are not yet present in this repository. Screenshot-derived fallback colors are declared once in `monitoring.css` for later alignment with M5's shared tokens.

## Preview

From the repository root:

```powershell
npm.cmd run dev -w apps/web -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173/src/features/monitoring/preview/index.html> (use Vite's printed port if different).

The standalone preview does not reproduce M5's sidebar/header. Its development controls switch between success, empty, and error datasets. Loading is visible during mock service requests. The normal `/` app remains the Vite starter, as requested by the feature-only scope.

## Behavior and data

- Past hour, past 24 hours, and past 7 days select distinct, deterministic mock datasets, including summaries, chart buckets, latest events, and alerts.
- Contract rows open an inspection dialog with events for that contract. Browse opens events across contracts; the contract selector filters the inspection dialog.
- View all controls open full contract or recent alert summaries. Alerts can lead to contract event inspection.
- Configure Watchers changes enabled watchers in memory and updates the watcher summary. Preferences reset on remount/reload. Static historical events remain unchanged.
- Chart values are also available in an accessible data table. Dialogs have accessible names, native keyboard focus containment, Escape handling, and focus restoration.
- Every snapshot and watcher action is explicitly identified as mocked. There is no live telemetry, persistence, blockchain transaction, or API dependency.

The time selector, mock snapshot label, latest-events section, and chart-data disclosure extend the screenshot to meet the sprint's functional and accessibility requirements. The event inspection and watcher dialogs follow the screenshot's existing card/control palette. They are functional extensions, not additional supplied Figma frames.

Types live in `types.ts`, fixtures in `mocks/monitoring.ts`, and the asynchronous service boundary in `services/monitoringService.ts`. These are feature-local mock contracts, not cross-module API agreements.

## M5 integration handoff

Export: `MonitoringDashboard` from `features/monitoring`.

Register `/projects/:projectId/monitoring` in the shared React Router setup. Pass its project parameter as `projectId`; key the page by project ID when switching projects. An optional `service` prop accepts a replacement `MonitoringService` implementation.

Pass React Router's `navigate` function as `onOpenEventExplorer`. This enables an Open Events Explorer button for the selected contract and supplies the encoded path `/projects/:projectId/monitoring/contracts/:contractId/events`. Register the exported `ContractEventsExplorer` at that route, passing both route parameters. The local preview demonstrates this transition with component state only; shared routing remains M5's responsibility.

Use the preview's Page selector to open Events Explorer directly, or select a dashboard contract and choose Open Events Explorer. No duplicate application shell or global router is installed.

## Verification

- `npm.cmd run build -w apps/web`: TypeScript and existing app production build.
- `npm.cmd run lint -w apps/web`: repository ESLint checks.
- The feature preview was additionally bundled with Vite's programmatic build API, using the preview HTML as an entry and `dist/monitoring-preview` as the output directory. The default app build does not include this unregistered feature's runtime bundle.
- `review/verify.mjs` exercises the actual React preview in headless Chrome through the browser's debugging protocol, using Node's built-in WebSocket and fetch APIs. It verifies datasets, watcher updates, contract inspection, alert summaries, dialog naming, Escape/focus restoration, desktop/mobile overflow, mobile dialog sizing, empty/error/loading/retry states, and browser runtime errors.
- Screenshots: [desktop](review/desktop.png), [mobile](review/mobile.png). Viewports: 1075px desktop content width (equivalent to the supplied 1280px layout after its sidebar), and 375px mobile.

To rerun browser verification, start Vite as above, then start a dedicated headless Chrome instance on local debug port 9222 with an isolated temporary profile. From the repository root run:

```powershell
$reviewProfile = Join-Path $env:TEMP 'chainops-monitoring-review'
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1',('"--user-data-dir=' + $reviewProfile + '"'),'about:blank' -WindowStyle Hidden
node apps/web/src/features/monitoring/review/verify.mjs
```

The script refreshes both review screenshots. The debug browser is a dedicated review instance; close it after use.

## Commit / PR handoff

No commit, push, issue, or PR was created. Work remains on the user's existing `feat/Implement-Monitoring-Overview` branch. Before publishing, use the real issue number and follow `CONTRIBUTING.md`'s `feat/issue-<number>-monitoring-dashboard` branch convention. Target `dev` and request another team member's review, including M5 for integration.

Suggested commit and PR title: `feat(m3): add contract monitoring dashboard`.

The PR should link the actual issue, include the supplied design export and the review screenshots, list the verification results, explicitly identify mock behavior, and note the missing exact Figma URL and pending M5 route integration. Do not invent an issue number or claim route registration is complete. Keep Task 1 and Task 2 in separate issue-linked commits/PRs when publishing; both currently remain uncommitted in the existing working tree.
