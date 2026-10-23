# M3 monitoring, events and alerts

Implemented on `feat/monitoring-ui` using the existing React/Vite application, NestJS API, SQL migrations and shared PostgreSQL pool. The application monitoring route now uses real APIs. The earlier mock dashboard/explorer remain available only through their existing isolated preview exports.

## Start locally

From the repository root, use the existing ignored `.env.local` for the database and M5 authentication configuration. Then:

```powershell
npm.cmd install
npm.cmd run db:migrate -w apps/api
npm.cmd run build:api
npm.cmd run dev:api
```

In a second terminal:

```powershell
npm.cmd run dev:web
```

In a third terminal, after building the API:

```powershell
npm.cmd run start:monitoring-worker -w apps/api
```

Sign in normally and open `http://localhost:5173/projects/YOUR_PROJECT_UUID/monitoring`. Existing sidebar links using the old `chainvault` placeholder lead to an authorized project chooser. `/alerts` also offers project selection. The chooser lists only projects in the signed-in user's organizations.

Migration `005_monitoring_runtime.sql` extends the existing M3 configuration without dropping or resetting tables. Apply it to the intended development branch before using the new pages. This implementation run applies migrations only to disposable local PostgreSQL, not Neon.

## M2 and RPC setup

The current M2 `/projects/:projectId/contracts` API contains **artifact metadata**, not deployed addresses or ABIs. M3 does not turn artifacts into pretend deployments or create another Contract Registry. With the current repo alone, the Add Contract page explains that deployed metadata is unavailable. Existing interim targets remain visible, but cannot be enabled without a registry association and ABI subscriptions.

When M2 provides a deployed-contract API, configure these **server-only** values:

```dotenv
# The base URL of M2's deployed registry API, not its artifact-only API:
MONITORING_REGISTRY_API_URL=https://YOUR_DEPLOYED_REGISTRY_API
# Optional service-to-service credential; never put it in a VITE_ variable:
MONITORING_REGISTRY_API_TOKEN=
MONITORING_SEPOLIA_RPC_URL=https://YOUR_SEPOLIA_RPC_ENDPOINT
```

The registry adapter requests `GET <base>/projects/<projectId>/contracts` and expects an array of project-scoped records:

```json
[
  {
    "id": "DEPLOYED_CONTRACT_UUID",
    "projectId": "PROJECT_UUID",
    "name": "Vault",
    "version": "v1.4",
    "network": "sepolia",
    "address": "0x0123456789abcdef0123456789abcdef01234567",
    "abi": ["event Withdrawal(address indexed owner,uint256 amount)"]
  }
]
```

An optional `release` object may supply `commitSha`, `pipelineRunId`, and `artifactId`. M3 validates and snapshots these identifiers with indexed events. The registry remains the owner of deployment/ABI metadata. Changing a target's address, network, or version in the registry fails closed until the deployment association is reconciled; it does not silently decode old evidence with a new ABI.

RPC requests are read-only HTTP JSON-RPC, bounded by timeouts and range limits. The endpoint's chain ID must match Sepolia (`11155111`). No public default RPC, wallet, signing key, or transaction submission is introduced. HTTP polling is used because this repo has no established real-time channel. The browser refreshes supported lists every ten seconds while visible and aborts/unsubscribes on unmount or project change.

## Screen and route coverage

Visual reference: [compact Figma M3 frames](https://www.figma.com/design/WS4Vdr0VXtoBYKx1FatKyX?node-id=2097-33075).

All paths below start with `/projects/:projectId/monitoring`:

| Figma frame | Node | Implemented route/state |
| --- | --- | --- |
| 62 · monitor | 2097:33075 | `/` overview with actual watcher checkpoints and counts |
| 63 · events | 2097:33314 | `/events`, filters, pagination and current-page CSV |
| 64 · decoded | 2097:33487 | `/events/:eventId`, decoded args, raw log, ABI and evidence |
| 65 · watchers | 2097:33598 | `/watchers`, selection, tabs and persisted settings |
| 66 · watcherEdit | 2097:33728 | Disconnected/paused state of the same watcher page |
| 67 · watcherSaved | 2097:33861 | Success state after a settings mutation |
| 68 · addContract | 2097:33943 | `/contracts/new`, selection from M2 only |
| 69 · subscription | 2097:34032 | `/watchers/:watcherId/subscriptions/new`, ABI event selection |
| 70 · alerts | 2097:34121 | `/alerts`, search, severity/status/period filters |
| 71 · rules | 2097:34277 | `/rules`, persistent list and enable/disable |
| 72 · createRule | 2097:34432 | `/rules/new`, typed conditions and preview |
| 73 · alert | 2097:34558 | `/alerts/:alertId`, original event/rule evidence |
| 74 · ack | 2097:34697 | Acknowledged state on the same detail route |
| 75 · resolved | 2097:34836 | Resolved state on the same detail route |

Existing `/monitoring/contracts/:contractId/events` links remain supported. Saved, disconnected, acknowledged and resolved frames are states, not duplicated routes.

Page content uses the Figma surface, spacing, typography and control tokens with the existing local Inter font. M3 page content contains no static image/icon assets requiring export; text glyph controls and data-driven charts follow the supplied frames. The existing shared M5 shell is reused. Its pre-existing sidebar labels, header/search/profile/notification differences from Figma were not redesigned or duplicated. Only the Alerts link destination changes to preserve project context. Figma's fictional transaction-failure trend is replaced by actual triggering chain evidence; the API currently evaluates event rules, not failed-call or infrastructure rules.

## API contracts

New API routes start with `/projects/:projectId/monitoring`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/overview?range=1h\|24h\|7d` | Actual summary and throughput |
| GET | `/registry-contracts` | Read M2 candidates or dependency state |
| GET | `/watchers` | Settings, checkpoint and truthful health |
| POST | `/targets` | Associate `{registryContractId}` with monitoring |
| PATCH | `/watchers/:id` | Save `{enabled,pollingSeconds,confirmations,startBlock?}` |
| GET | `/watchers/:id/catalog` | Registry ABI events and subscriptions |
| POST | `/watchers/:id/subscriptions` | Add `{signature}` present in the ABI |
| DELETE | `/watchers/:id/subscriptions/:subscriptionId` | Remove an event subscription |
| POST | `/test-connection` | Bounded Sepolia RPC/chain check |
| GET | `/events` | Filtered, paginated indexed events |
| GET | `/events/:id` | Decoded detail and adjacent event IDs |
| GET / POST | `/rules` | List/create extended typed rules |
| PATCH | `/rules/:id` | Enable/disable with `{enabled}` |
| GET | `/alerts` | Paginated inbox |
| GET | `/alerts/:id` | Evidence, actor names and transition history |
| POST | `/alerts/:id/acknowledge` | Atomic acknowledgement with optional `{note}` |
| POST | `/alerts/:id/resolve` | Atomic resolution with optional `{note}` |

`GET /monitoring/projects` lists authorized project choices. The four original `/projects/:id/monitored-contracts` and `/projects/:id/alert-rules` APIs remain compatible.

Browser calls use a Vite `/api` proxy that strips `/api` before forwarding to Nest. **Nest itself has no global `/api` prefix.** Production hosting must provide equivalent same-origin routing. Browser requests reuse M5's root-path HttpOnly access cookie; cookie-authenticated writes require the existing Origin and double-submit CSRF check. Existing Postman Bearer tokens still work without cookie CSRF. No token is exposed to browser JavaScript or stored in localStorage. Authentication/session validation and project organization membership apply to every domain endpoint.

Parameter rules use `{field,operator,value}`; values remain exact unsigned decimal strings and operators are `eq`, `gt`, `gte`, `lt`, `lte`. Count rules use `mode: "count"`, `condition.field: "count"`, and a `windowSeconds` from 60 to 86400. Parameter mode has no window. Project-wide rules evaluate independently for each contract. Newly indexed canonical events are evaluated; rules do not retroactively scan history on creation. Each matching new event can produce one alert per rule. Cooldowns/incident grouping are not yet implemented.

## Worker, evidence and notifications

`monitoring_jobs` is the durable scheduled queue. Workers claim five-minute leases using `FOR UPDATE SKIP LOCKED`. Settings/subscription changes invalidate outstanding leases. A worker must still hold its lease and find the watcher enabled before committing.

Each scan reads at most 100 confirmed blocks and 2000 logs. With no explicit start block, it begins at the confirmed head; an explicit start block supports bounded backfill. Each subsequent scan replays the last twelve blocks. Events are uniquely identified by project, network, transaction hash, log index and block hash. Reconnects/replays do not duplicate alerts or outbox records. The decoder uses the registered ABI and stores bigint values as decimal strings. Unmatched/undecodable logs retain their raw evidence and a decode error.

Shallow reorgs mark missing logs removed and invalidate their alerts without deleting history. Reappearing identical evidence can be canonical again. Deeper reorg recovery and finality beyond the configured confirmations/replay horizon need operational reconciliation; this is not a full chain indexer. Paused, unconfigured, pending, catching-up, stale and degraded states are displayed separately from healthy indexing. Test Connection proves RPC reachability, not worker health.

Acknowledgement and resolution lock the alert row, derive the actor from authentication, save timestamps/notes, preserve evidence, and reject repeated/terminal transitions. Alerts invalidated by removed events cannot be acknowledged or resolved. Reopen is not a supported transition.

M3 writes outcome records to `monitoring_alert_outbox`; M5 owns notification delivery. The shared notification inbox/popover is not duplicated. Email and in-app channel controls remain disabled with a reason until M5 provides delivery integration. Notification provider failure cannot destroy the persisted alert.

## Verification and screenshots

See [executed verification results and PR handoff](M3_VERIFICATION.md).

```powershell
npm.cmd run build
npm.cmd run lint -w apps/api
npm.cmd run lint -w apps/web
npm.cmd test -w apps/api
npm.cmd run test:monitoring -w apps/web
npm.cmd run test:auth -w apps/web
npm.cmd run test:security -w apps/web
# Set to a disposable direct PostgreSQL URL, not production:
$env:MONITORING_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DATABASE'
npm.cmd run test:e2e -w apps/api
```

`monitoring-runtime.e2e-spec.ts` applies migrations to a uniquely named schema and exercises real PostgreSQL/HTTP/auth/worker behavior with test-only registry and chain gateway fixtures. It tests CSRF/cookie and Bearer authentication, subscriptions, settings, precise decoding, parameter/count rules, deduplication, worker leasing, cross-project isolation, concurrent acknowledgement, resolution, reorgs, backoff and pause. Production has no fixture mode.

The headless Chrome review in `apps/web/src/features/monitoring/review/verify-live.mjs` uses browser-only intercepted API fixtures, not live Neon/Sepolia, to exercise the actual app routes and capture desktop/mobile screens. It verifies mutations, unavailable states, retry, exact decoded values, page overflow and runtime errors. Run with an isolated Chrome debugging instance on port 9444:

```powershell
$m3ReviewProfile = Join-Path $env:TEMP 'chainops-m3-review'
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9444','--remote-debugging-address=127.0.0.1',('"--user-data-dir=' + $m3ReviewProfile + '"'),'about:blank' -WindowStyle Hidden
node apps/web/src/features/monitoring/review/verify-live.mjs
```

Artifacts: [overview desktop](../apps/web/src/features/monitoring/review/live/overview-desktop.png), [watchers desktop](../apps/web/src/features/monitoring/review/live/watchers-desktop.png), [mobile](../apps/web/src/features/monitoring/review/live/watchers-mobile.png). The review server and dedicated browser close after the run.

Live M2/RPC configuration, live Sepolia ingestion and M5 notification delivery remain unverified/unavailable until those integrations are supplied. No Neon migration, production writes, commit, push or PR are performed by this development run.

Suggested commit and PR title: `feat(m3): implement monitoring events and alert workflows`. PR target: `dev`; request one reviewer. Use the actual issue number if one is later supplied; none is invented here.
