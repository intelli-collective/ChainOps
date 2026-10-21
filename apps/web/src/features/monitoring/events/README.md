# M3-FE-02 · Contract Events Explorer

Implements Member 3's second sprint task from the Contract Events screenshot supplied in the conversation. The exact Figma URL was not supplied. Shared shell, route registration, global configuration, dependencies, and other modules remain unchanged, following the user's feature-only scope.

## Review

Start Vite from the repository root with `npm.cmd run dev -w apps/web -- --host 127.0.0.1`.

Open <http://127.0.0.1:5173/src/features/monitoring/preview/index.html> and choose **Events Explorer** in the preview's Page selector. Alternatively, select Vault on the dashboard, then choose **Open Events Explorer** to verify contract context carries over. Monitoring in the breadcrumb returns to the dashboard.

The reference's table layout, initial row names/times/blocks, filters, actions, and palette are reproduced in the content area. The supplied screenshot has no mobile variant; filters stack on mobile and the semantic table scrolls inside its focusable container. Native date controls follow the browser's display locale but are explicitly interpreted as UTC.

## Interactions

- Contract, event-type, From/To UTC, and minimum/maximum block filters combine. Clear removes all filters. Date/block changes reset pagination and expanded rows.
- The initial UTC date is 26 October 2026 to match the supplied design's sample data, not the current date. To includes the whole selected minute. Invalid date/block ranges show an accessible error and disable CSV export.
- All 248 records are deterministic mocks, with 10 rows per page. Next/Previous work and disable at the boundaries.
- View expands decoded parameters, full transaction hash, block, timestamp, network, and log index inline. Hide collapses the row. Block buttons also open these details.
- Export CSV downloads **all matching records**, across pages, including decoded parameters. Values are quoted and spreadsheet formula prefixes are escaped. The filename and data-source column identify the export as mocked.
- Automatic refresh starts paused. The Live · mock toggle re-fetches the same mock snapshot every 15 seconds while enabled; it never claims live chain connectivity. Timers clean up on unmount.
- Loading, service error/retry, no indexed events, no matching results, and unknown-contract states are implemented.

Transaction hashes, addresses, and decoded parameters are synthetic fixture values. No transaction/block explorer links are generated. No backend, blockchain, persistence, or new package is required.

## Integration

Export `ContractEventsExplorer` from `features/monitoring` and register it in M5's shared React Router at `/projects/:projectId/monitoring/contracts/:contractId/events`.

Props:

- `projectId`: required route/project context.
- `contractId`: selected route contract; omit only for an all-contract preview.
- `service`: optional `EventsService`, defaulting to `mockEventsService`.
- `onBackToMonitoring`: optional callback that M5 can connect to React Router navigation.

Project or route-contract changes reset the explorer's local filter/page state. Wire dashboard `onOpenEventExplorer` to React Router's `navigate` after both routes are registered. The preview uses component state to demonstrate the transition without changing the global router.

`types.ts`, `mocks.ts`, `service.ts`, and `filterEvents.ts` keep the data and service boundary separate from rendering. These remain local mock interfaces until cross-module/API contracts are agreed.

## Verification and review assets

Run build and lint from the repository root:

```powershell
npm.cmd run build -w apps/web
npm.cmd run lint -w apps/web
```

For browser checks, start Vite and the dedicated debug Chrome instance described in the [monitoring README](../README.md), then run:

```powershell
node apps/web/src/features/monitoring/review/verify-events.mjs
node apps/web/src/features/monitoring/review/verify.mjs
```

The explorer checks exercise contract handoff, filtering, page changes, validation, decoded expansion, actual CSV file download/content, mock refresh toggling, desktop/mobile overflow, and loading/empty/error/retry states. The second script checks Task 1 for regressions. A separate Vite build with the preview HTML entry validates the runtime bundles for both features; the normal starter app build does not yet import them.

Screenshots: [desktop](../review/events-desktop.png), [mobile](../review/events-mobile.png). Content widths: 1075px and 375px.

## Publishing handoff

No issue, commit, push, or PR was created. Follow repository `CONTRIBUTING.md`: use a real issue number in `feat/issue-<number>-contract-events-explorer`, target `dev`, and request a team member's review. Suggested commit/PR title: `feat(m3): add contract events explorer`.

Include the actual issue, supplied screenshot, review images, test results, mock-data note, and pending M5 route integration in the PR. No exact Figma URL or issue number has been invented. Keep this task separate from Task 1 when preparing commits/PRs.
