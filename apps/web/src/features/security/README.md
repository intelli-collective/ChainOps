# Issue #26 — Security Findings Dashboard

Feature implementation for `/projects/:projectId/security`.

- Issue: https://github.com/intelli-collective/ChainOps/issues/26
- Visual source: https://www.figma.com/design/wr9kWmDlC4csbPMYLH9vGt?node-id=27-269
- Branch: `feat/issue-26-security-dashboard`, based on `dev`.
- Intended PR base: `dev`.

## Implementation

The dashboard provides the Figma findings table, original four severity cards,
combined search/severity/finding-status/contract filters, clear filters, scan
selection, scan-details navigation callbacks, an optional Analysis Complete
callback, and a development-only simulated
analysis. Latest and historical scan status, finding severity, and policy result
are separate fields and UI labels. A completed scan can have a blocked policy.
Failed/running scans do not show zero counts or a passed policy.

The types `SecurityScan`, `SecurityFinding`, `Severity`, `FindingStatus`,
`ScanStatus`, `PolicyDecision`, and `SecurityService` live in `types/security.ts`.
`SecurityDashboardProps` supplies project identity, an injected service, and M5's
navigation function. Mock fixtures live outside presentation code and contain
completed/blocked, completed/passed, completed/requires-review, and failed scans.
The mock adapter returns isolated snapshots, supports cancellation, rejects use
outside Vite development, and never contacts Slither, an API, or a database.

Loading, empty history, no findings, no matching filters, load error/retry,
running scan, failed scan, and analysis-action error are handled. An action error
preserves prior results. The preview exposes all these scenarios. Its `loading`
scenario delays for 60 seconds; it can be cancelled by selecting another scenario.

## Files created

All paths below are relative to this feature directory:

- `types/security.ts`: feature-local domain and adapter contract.
- `mocks/securityFixtures.ts`: Figma findings and illustrative scan history.
- `services/mockSecurityService.ts`: development-only mock adapter/scenarios.
- `securityUtils.ts`: counts, combined filtering, labels, dates, encoded paths.
- `components/FindingTable.tsx`: semantic table and finding navigation.
- `pages/SecurityDashboard.tsx`: page, state handling, selection, interactions.
- `pages/security.css`: scoped styles using approved Figma token names/fallbacks.
- `index.ts`: public feature exports.
- `preview/index.html`, `preview/main.tsx`, `preview/Preview.tsx`: isolated preview.
- `assets/Inter-Latin.woff2`, `assets/OFL.txt`: locally served Inter and its license.
- `security.spec.ts`: 11 focused tests using the already-installed Vitest.
- `README.md`: this integration/verification report.

No existing files, shared shell/router files, dependencies, lockfiles, or backend
files were modified. No new UI or test framework was installed.

## Figma deviations/additions

Explicitly approved by the user to satisfy Issue #26:

- Keep Critical / High / Medium / Low as the four primary cards, in that order,
  with the frame's dimensions, spacing, typography, and labels at desktop width.
- Add a compact strip immediately below them containing scan-history selection,
  scan status, separate policy result/reason, and a scan-details action.
- Show Informational as a lower-emphasis count in that strip and a separate
  severity filter; it is not grouped with Low in the data. The original Low card's
  descriptive “Informational” caption remains because it is in the approved frame.
- Add explicit development/mock disclosure in the isolated preview only. Its
  Run Analysis simulates an in-memory scan, never a real analyzer or
  authoritative policy evaluation. The reusable dashboard contains no
  preview-only scenario selector or disclaimer.

The original heading, subtitle, cards, filters, table, and footer remain in their
original order. No gradients or new theme were added. Responsive layouts wrap
controls/cards and confine horizontal scrolling to the table. These responsive
and transient states were not provided as separate Figma variants.

The Figma sidebar, toolbar, and logo belong to M5's shared shell and are not
duplicated here. No Figma image/SVG asset occurs within the implemented page
content (node `27:296`); the asset URLs returned for the full frame are for its
shared branding. Inter is bundled from Google Fonts, under the included SIL OFL:
https://fonts.google.com/specimen/Inter. The font asset has no runtime network
dependency. M5 may centralize font loading once shared typography is available.

## Shared integration dependencies

The inspected repository contains a React/Vite starter and a NestJS starter;
there is no shared application shell, React Router, approved token file, or UI
component library yet. Global CSS and App.tsx still render the Vite starter.
The root README's older FastAPI technology table does not match the actual
NestJS workspace. Both root and web lockfiles already existed and were preserved.
The existing 85 tracked files were inventoried, application sources/configuration
and text guidance reviewed, and lockfiles parsed. Binary proposals and diagrams
were inventoried, not subjected to a full visual/content audit.

M5 must register `/projects/:projectId/security` inside the shared shell and pass
the route's projectId, service, and React Router `navigate` to the exported page:

```tsx
<SecurityDashboard projectId={projectId} service={securityService} onNavigate={navigate} />
```

Keep the service instance stable (module scope or useMemo). Use the mock factory
only in development, with fixture projectId `chainvault`; other projects return
empty histories. Inject a future API adapter for production. The feature's default
export surface does not automatically import the mock service or preview.

`View scan` calls `/projects/:projectId/security/scans/:scanId`; finding titles
append an encoded finding ID hash. The preview displays the requested path so the
callback can be inspected without pretending the destination page exists. M5
must register the destination; its actual content belongs to M4-FE-02. No shared
route is registered by this change, so the requested production route is not yet
available. This is an integration dependency, not a completed routing claim.

The optional `onAnalysisComplete(scan)` callback fires after `runAnalysis`
resolves. The preview reports the returned scan ID. M5 can wire it to the
separate Analysis Complete screen represented by Figma `27:497` when its route
is agreed; Issue #26 does not implement that destination. If no callback is
provided, the dashboard selects the newly returned scan and remains usable.

M5 should render this page in the content area without a second layer of content
padding and provide the matching shared `--co-*`, `--color-*`, and `--radius-md`
tokens. Scoped fallbacks use the exact values returned by Figma. Global starter
styles will need replacing as part of M5's shell work.

## Validation results

- `npm run build -w apps/web`: passed; TypeScript checks include the feature.
- `npm run lint -w apps/web`: passed.
- `npx --no-install vitest run apps/web/src/features/security/security.spec.ts --config apps/api/vitest.config.ts`: 11 tests passed, no new config/framework.
- Separate Vite library build of `src/features/security/index.ts`: passed. This
  verifies feature bundling even though the starter app does not import it yet.
- Preview HTML, entry, page, and CSS: HTTP 200 through the Vite development server.
- `git diff --check`: passed before committing.
- Figma high-fidelity context and reference screenshot inspected before coding;
  code dimensions/colors/spacing reviewed against that context.
- **Rendered screenshot comparison and manual browser interaction/accessibility
  checks remain pending.** Browser runtime setup reported no available browser;
  discovery returned an empty list. HTTP and unit checks do not substitute for
  those checks. No visual screenshot or pixel-match claim is made.

## Exact manual test steps

1. From the repository root, run `npm ci`, then `npm run dev:web`.
2. Open `http://localhost:5173/src/features/security/preview/index.html`.
   The development-scenario control is preview tooling, outside the feature page.
3. With `populated`, verify 0 Critical, 1 High, 2 Medium, 5 Low, 0 Informational;
   8 rows; scan Completed and policy Blocked. Verify the mock disclaimer.
4. Select High severity: one SLT-001 row and the Figma `27:421` footer,
   “Showing 1 high-severity finding”. Clear. Search `REENTRANCY`: one row.
   Clear. Set Low + Open + Token.sol: two rows.
   Search a nonexistent title: no matching findings. Clear filters: eight rows.
5. Select Informational on scan 130: no matches. Choose scan 129: one
   Informational finding, Completed / Passed. Choose scan 128: Requires review.
   Each scan selection resets filters and updates revision/counts.
6. Choose scan 127: Failed, no policy evaluation, unavailable counts, explicit
   analyzer error. Do not treat this as a clean scan.
7. Activate View scan and a finding title with keyboard and mouse. The preview
   reports the encoded scan route and, for findings, the finding hash.
8. Run Analysis: the button disables while mock analysis runs; results/policy
   become unavailable during the simulation. A new scan is selected afterward;
   its analysis number increments while linked pipeline run stays 130. The
   preview also reports the Analysis Complete callback with the new scan ID.
9. Select `empty`, then Run Analysis: a mock scan appears. Select `clean`: no
   findings with a distinct passed policy. Select `running` and `failed` to
   inspect scan lifecycle states.
10. Select `loading`, then another scenario to cancel it. Select `error`: verify
    load failure and Retry (the persistent error fixture intentionally fails
    again). Switch to `populated` to recover. Select `run-error`, click Run
    Analysis, and verify the action error preserves previous findings/history.
11. Compare the page content with Figma at a 1210px content width (the full frame
    is 1440px including M5's 230px sidebar). Check a 390px mobile width: controls
    wrap, cards form two columns, only the table scrolls horizontally. Check
    keyboard focus visibility, field labels, table navigation, and announcements.
12. After M5 integration, test actual route parameters, forward/back navigation,
    the shared shell, and the registered details destination. Attach desktop and
    mobile screenshots to the PR after visual verification.

Suggested final/squash commit and PR title:
`feat(m4): add security scan results dashboard`

Use `Refs #26` while shared routing and visual/manual verification are outstanding;
use `Closes #26` only when the team accepts the fully integrated deliverable.
