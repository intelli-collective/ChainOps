# M2-FE-01: Contract deployment

Target route: `/projects/:projectId/deployments/new`.

## Current scope

The supplied reference image covers **Prepare a deployment → Select approved
release**. This feature implements that content area without changing Member 5's
shared shell, routing, dependencies, or global styles. The screenshot is the
current visual reference; an exact Figma frame URL has not been supplied.

Artifact selection, network configuration, deployment naming, confirmation,
submitting, and simulated result/error states extend the supplied style with the
user's explicit approval. M2-FE-02 is not included. There are no constructor
parameters in this fixture flow and no private-key inputs.

The second supplied reference now defines the **Deploy Contract → Artifact**
screen: four-step progress, pinned release context, build-run radio rows, and
artifact radio rows with filenames and sizes. Continue from the release screen to
open it. The other steps use the previously approved style extension.

Only the successful run matching the pinned release's number and commit is
selectable. Other successful runs require choosing their own approved release;
failed runs are disabled. “View all runs,” “View build artifacts,” and artifact
filenames open mock metadata dialogs. Selected artifacts and form values persist
when moving backward and forward within the wizard.

## Platform integration

Import `DeploymentPage` from this directory's `index.ts` and provide:

- `projectId`: the route parameter (mock fixture project: `chainvault`).
- `historyHref`: the router-resolved deployment history URL.
- `onContinueToArtifact(release)`: optional notification when entering the artifact step.
- `network`: current network label; defaults to `Sepolia Testnet`.
- `service`: optional injectable data service, defaulting to `mockDeploymentService`.

The feature handles its own form steps. Member 5 should register the route and provide the application shell. The history
link uses a standard anchor until that router exists; replace it with the shared
router link during integration. No router package is currently installed.

## Mock behavior and verification

The mock service returns two releases after a short delay. It makes no backend or
blockchain calls. An unknown project returns an empty collection. A rejected
`getApprovedReleases` promise displays an error and a retry action.
Artifact loading also handles empty/error responses. A rejected
`simulateDeployment` promise keeps the review dialog open with a retry action and
preserves the form. The native modal traps focus and supports Escape/cancel when
not submitting. Repeated submission is guarded while pending.

The injectable service now includes `getBuildRuns(releaseId)` for deployment-local
run summaries. This is not a shared pipeline API contract.

Check release switching and verify that Continue passes the selected release to
the callback. Missing selection, unsuccessful builds, insufficient approvals, or
an unsupported network disable Continue and are checked again before continuing.

Run `npm run build -w apps/web` and `npm run lint -w apps/web` from the repository
root. Both passed. Temporary SSR/service checks also passed for valid simulation,
invalid project/network/artifact/name rejection, mock-only output, and disabled
Continue for missing selection, failed builds, insufficient approvals, and an
unsupported network. The temporary harness was removed after checking.

Browser comparison, responsive visual review, and browser interaction checks
remain outstanding because no browser is connected in this session. No exact
Figma URL or GitHub issue number was supplied, so those links and screenshots
must be added before requesting PR review. No commit or PR has been created.

## Local preview

Run `npm run dev:web` from the repository root and open the local URL printed by
Vite (normally `http://localhost:5173/`). The app entry renders Task 1 using the
`chainvault` fixtures with a small mock-preview banner. Select a release, continue
to its artifact, enter a deployment name, review, and simulate the deployment.

The preview has no shared sidebar or application router. Its history link points
to a note explaining that history is outside this preview. Member 5 can replace
this temporary entry with the shared shell and register the exported page later.

## Artifact regression check

From the repository root, use the installed Vite SSR builder and Node:

```bash
./node_modules/.bin/vite build apps/web --ssr src/features/deployments/artifactSelection.check.tsx --outDir node_modules/.cache/deployment-check
node apps/web/node_modules/.cache/deployment-check/artifactSelection.check.js
```

This checks radio rows, pinned-run eligibility, failed/unapproved selection
rejection, all three artifact simulations, cross-release artifact rejection, and
empty service responses. Generated check output stays in ignored `node_modules`.
