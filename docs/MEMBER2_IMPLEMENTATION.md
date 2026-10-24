# Member 2 implementation

The Member 2 screens now live in the existing React application, using its router, session API, Inter font, and application layout. The Figma reference was inspected through live design context and screenshots. The supplied `.fig` archive was also inspected; live Figma provided the detailed visual reference.

The live application uses the NestJS release API. Sample data is restricted to an explicit development preview, with a visible preview notice. The preview module and route are excluded from production builds.

## Covered Figma frames

- 45 `2097:31101`: deployment history, transaction links, search, network/status/date filters.
- 46 `2097:31236`: eligible run and artifact selection with pinned provenance.
- 47 `2097:31363`: network cards, network details, deployment account.
- 48 `2098:26625`: published ABI viewer with search.
- 49–50 `2097:31609`, `2097:31721`: ABI-derived constructor inputs, validation and preserved invalid values.
- 51–52 `2097:31831`, `2097:31963`: review and blocked preflight states.
- 53 `2097:32093`: signing review and duplicate submission protection.
- 54–57 `2097:32194`, `2097:32297`, `2097:32397`, `2097:32497`: pending, confirmed, reverted and unknown outcomes.
- 58 `2097:32597`: transaction overview, timeline, receipt/log/raw tabs.
- 59–61 `2097:32735`, `2097:32853`, `2097:32951`: registry, external registration and contract details.

Variants are states of the same wizard/resource. No separate invalid-parameter, failed-deployment or unknown-outcome routes were introduced. Contract metadata and recent events are rendered when supplied; live data is not fabricated to fill design examples.

## Routes

All live routes retain the existing authenticated application shell:

- `/projects/:projectId/deployments`
- `/projects/:projectId/deployments/new`
- `/projects/:projectId/deployments/:deploymentId`
- `/projects/:projectId/deployments/:deploymentId/transaction`
- `/projects/:projectId/contracts`
- `/projects/:projectId/contracts/register`
- `/projects/:projectId/contracts/:contractId`
- `/projects/:projectId/contracts/:contractId/abi`
- `/projects/:projectId/artifacts/:artifactId/abi`
- `/projects/:projectId/smart-contracts` opens the contract list.

`/deployments` now opens deployment history. Landing and authentication screens were not changed.

## Development demonstration

Run `npm run dev:web`, then visit `/preview/member-2/deployments` on the Vite port. A server started during implementation used port 5174 because 5173 was occupied.

1. Open **New deployment**, select a run/artifact and network, and continue to parameters.
2. Enter `0x123` to exercise invalid address validation, then use the valid sample value.
3. Continue to review. **Review a blocked preflight** demonstrates the blocked design; return to review to continue.
4. Confirm the signing request with **Sign & submit (demo)**. This sends no transaction. Refresh status three times, or wait for preview polling, to reach the sample confirmed state and add the sample contract to the registry.
5. The initial history includes confirmed, pending, failed and unknown records. Unknown reconciliation preserves uncertainty. Sample hashes have no explorer links.
6. Register an existing contract from the registry. Its record is marked **External registration**, with no fabricated build, approval or deployment provenance. Sample registrations persist in session storage.

## Components and assets

The implementation extends `ApplicationLayout` for Member 2 routes, rather than adding a router or another app shell. Other modules retain their current rendering. It introduces feature pages for history, the wizard, transaction details, the registry, registration and contract detail; shared panels, headings, resource states and status rendering; and an API adapter with explicit preview injection.

Figma sidebar icons, approved logo, bell, chain-link icon, chevron and preview avatar are local files in `apps/web/public/assets/member2`. SVG callsites retain their exported root dimensions. The preview avatar is sample data; live account identity comes from `/auth/me`.

The toolbar supports navigable search, profile/sign-out integration, notification integration status, outside-click dismissal and Escape dismissal with trigger focus restoration. Shared modules that are unavailable expose a disabled navigation action with a reason. Notification data remains owned by M5; no parallel notification store was created.

## API

The feature consumes endpoints under `/api/projects/:projectId/release`:

- `GET /artifacts`, `GET /networks`
- `GET /deployments`, `GET /deployments/:id`
- `POST /preflight`, `POST /deployments`
- `POST /deployments/:id/reconcile`
- `GET /registry`, `GET /registry/:id`, `POST /registry`

The Vite `/api` proxy targets the existing local API. These routes reuse the cookie session, `ProjectAccessService`, and origin-bound CSRF rule. Registry reads and writes recheck organization membership in SQL. Inputs reject unknown fields, including client-supplied approval/status/provenance/RPC values. Registration normalizes addresses and handles duplicate network/address records. It does not claim on-chain verification.

The registry POST accepts `{ "name": "Escrow", "version": "v1.0", "address": "0x…", "networkId": "configured-network-id" }`. The server must supply the permitted project network through the environment adapter. The client cannot provide RPC URLs, signing accounts or secrets.

## Database

`apps/api/migrations/005_member2_release.sql` adds `deployment_records` and `registered_contracts`. It includes project-scoped uniqueness, idempotency-key uniqueness, composite deployment/project references, external/deployed provenance constraints, and a successful-receipt/confirmation requirement for confirmed records. A registry trigger requires the same confirmed deployment, address and chain for deployment-derived registrations.

The migration was prepared but **not applied to the configured database**. SQL execution and persisted round trips against PostgreSQL remain unverified. No credentials or database contents were printed or changed.

## Integration dependencies and limitations

The repository currently provides artifact definitions and pending approval requests, not published validated ABI/bytecode snapshots or executable approval decisions. It also has no established signing adapter, project environment implementation, transaction worker or receipt reconciler.

Consequently, `ReleaseIntegration` is an explicit, fail-closed boundary: live artifact/network lists are empty; live preflight reports missing integrations; submission returns a conflict without sending a transaction; reconciliation preserves stored state and reports the missing RPC adapter. Registry persistence is implemented, but live registration cannot proceed until M5 supplies project networks. Replacing the artifact/network adapter alone does not enable submission: authoritative preflight, asynchronous execution/signing, idempotent worker processing, receipt reconciliation, atomic registry insertion and domain-event publication still require integration work.

- M1: exact immutable artifact, ABI, bytecode, digest, commit and pipeline-run publication.
- M4: authoritative eligibility and approval/policy evidence, revalidated before signing.
- M5: permitted project environments, configured signing boundary, shared notifications and search integration.
- M3: monitoring health and recent events for live contract detail.

No EVM library, wallet connector, private-key input, chain operation or external production deployment was introduced. The UI preview is interactive, but it is not evidence that a real contract was deployed. Tuple constructor inputs are explicitly unsupported; address, signed/unsigned integer, boolean, bytes, string and nested array validation are supported. Large array integers must be quoted to preserve precision.

The computer-use connection reported no available browser. Browser rendering, effective asset geometry, responsive appearance, and pixel-level comparison remain **unverified**. Asset files, SVG root dimensions, callsites, route rendering, interaction behavior and production exclusion were checked through source inspection, build output and automated tests.

## Validation

- `npm run build` — API and frontend build/typecheck passed.
- `npm run lint -w apps/web` and `npm run lint -w apps/api` — passed.
- `npm run test:member2 -w apps/web` — 21 parameter, flow, resource, toolbar, route-rendering and API-boundary tests passed.
- `npm run test -w apps/api -- src/deployments` — 9 new validation, CSRF/access and fail-closed release tests passed.
- `npm run test -w apps/api` — existing full suite passed: 126 tests at the time it was run, before the two additional guard tests were added. Initial sandbox-only socket failures were resolved by rerunning with local-port permission.
- `npm run test:auth -w apps/web` — 17 passed.
- `npm run test:security -w apps/web` — 24 passed.

Existing `package-lock.json` modifications and `FRONTEND_SPRINT_1.md` were present before this work and were left intact. No commit, push or PR was created.

## Suggested commit and PR

Commit / PR title: `feat(m2): implement deployment and registry screens with release API boundaries`

PR body:

```md
## Summary
Implement Figma Member 2 frames 45–61 in the existing application, including deployment preparation, lifecycle views and contract registration.

## Changes
- Add authenticated release API boundaries and registry persistence migration.
- Implement ABI parameter validation, preflight/signing review and transaction/registry views.
- Add an explicit development-only interactive preview; live submission remains blocked until upstream governance, environment and signer integrations exist.

## Testing
- API/frontend build and lint.
- Member 2 frontend and API tests; existing auth, security and API suites.
- Browser visual review and PostgreSQL migration execution remain outstanding.

## Checklist
- [x] Relevant automated checks passed
- [x] Integration boundaries and limitations documented
- [x] No secrets added
- [ ] Browser visual review completed
- [ ] PostgreSQL migration verified
- [ ] Link the team's actual tracking issue
```
