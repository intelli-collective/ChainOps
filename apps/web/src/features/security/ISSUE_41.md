# Issue #41 — Security Finding Details

Visual target: [Figma 27:517](https://www.figma.com/design/wr9kWmDlC4csbPMYLH9vGt?node-id=27-517). [Pipeline frame 18:592](https://www.figma.com/design/wr9kWmDlC4csbPMYLH9vGt?node-id=18-592) supplies related run context only. This feature does not render the pipeline page or the ChainOps shared shell.

## Integration

M5 can register `/projects/:projectId/security/scans/:scanId` in its shared router and mount the exported `SecurityFindingDetailsPage` in the content region. Pass the route's `projectId` and `scanId`, a stable `SecurityService` instance, and the shared router's `navigate` as `onNavigate`. Issue #26 finding links append an encoded finding ID hash; decode and pass it as optional `findingId` to select that finding. Without it, the service selects the first finding in the scan.

```tsx
<SecurityFindingDetailsPage
  projectId={projectId}
  scanId={scanId}
  findingId={location.hash ? decodeURIComponent(location.hash.slice(1)) : undefined}
  service={securityService}
  onNavigate={navigate}
/>
```

The page handles loading, lookup errors with Retry, missing scans, missing findings, and populated findings. Its found view exposes back-to-dashboard and linked-pipeline navigation through `onNavigate`. The pipeline destination uses M1's `pipelineRunPath`; this feature does not build that page. Tabs, source-context expansion, and acknowledgement are frontend interactions. Acknowledgement remains local to the mounted view and is explicitly marked unsaved. An API adapter and backend persistence are later integration work.

The mock service and scenario controls are development-only. The current `App.tsx` has no M5 shared security route or shell, so it is intentionally unchanged. The isolated detail preview is at `http://localhost:5173/src/features/security/preview/detail.html` after running `npm run dev:web` from the repository root. Its selector and mock disclosure live only in `preview/DetailPreview.tsx`, outside the production page.

## Figma deviations/additions

The compact policy-result card below finding metadata is required by Issue #41; the primary Figma frame does not show it. It reuses the existing border, card background, typography, spacing and approved status colors. Policy result, finding severity, and finding status remain separate concepts. The frame's sidebar/header are excluded because M5 owns the shared shell. Loading, error, missing-result, sparse-data, and mobile states extend the same visual language because the supplied frame depicts a populated desktop finding.

## Verification

Run `npm run build -w apps/web`, `npm run lint -w apps/web`, and `npm run test:security -w apps/web` from the repository root. The last command runs Issue #26 and Issue #41 security tests, including rendered UI interactions in jsdom. The preview supports populated, sparse, missing-scan, missing-finding, error, loading, and clean-scan scenarios. The `loading` mock intentionally remains pending for 60 seconds; changing scenario cancels it.

The production Vite build is currently still the app's existing preview routes. M5 must register the security route and supply an API-backed service before the details page is available in the shared application. The preview is an isolated development page, not evidence of shared-shell integration.
