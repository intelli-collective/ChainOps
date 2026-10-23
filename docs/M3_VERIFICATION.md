# M3 implementation verification — 23 October 2026

Branch: `feat/monitoring-ui`. Reference and implementation details: [M3 runtime guide](M3_MONITORING_RUNTIME.md).

## Executed checks

All project commands were run from the repository root.

| Command/check | Actual result |
| --- | --- |
| `npm.cmd run build` | PASS: NestJS and React/Vite production builds |
| `.\node_modules\.bin\tsc.cmd --noEmit -p apps/api/tsconfig.json` | PASS, including API test source files |
| `npm.cmd run lint -w apps/api` | PASS, no warnings in final run |
| `npm.cmd run lint -w apps/web` | PASS |
| `npm.cmd test -w apps/api` | PASS: 125 tests across 11 files |
| `npm.cmd run test:monitoring -w apps/web` | PASS: 8 tests |
| `npm.cmd run test:auth -w apps/web` | PASS: 17 tests |
| `npm.cmd run test:security -w apps/web` | PASS: 24 tests |
| `npm.cmd run test:e2e -w apps/api` | PASS: 57 tests across 7 files; 1 optional real Mailpit/SMTP delivery test skipped |
| `npm.cmd run db:migrate -w apps/api` | PASS on disposable local PostgreSQL: migrations 001 through 005, including all existing 004 files |
| Same migration command, second run | PASS: already up to date |
| Compiled standalone worker smoke check | PASS: application context initialized and durable queue polled |
| `node apps/web/src/features/monitoring/review/verify-live.mjs` | PASS: real app routes, browser-only fixtures, mutations, empty/error/retry, desktop/mobile layout and no runtime exceptions |

The integration run explicitly set `MONITORING_TEST_DATABASE_URL`, `AUTH_TEST_DATABASE_URL`, and `CONTRACTS_TEST_DATABASE_URL` to `postgresql://m3_runtime_test@127.0.0.1:55439/postgres`. The disposable PostgreSQL 18.3 cluster was created only for verification. Test suites created and removed isolated schemas. Migration-runner checks used that same local database, not the ignored `.env.local` database connection. No Neon migration or production data mutation was performed.

The new M3 runtime integration tests use actual PostgreSQL, HTTP controllers, JWT/session authentication, cookie CSRF and worker code. Only the unavailable M2 deployed registry and external chain gateway are replaced by test fixtures. They verify target creation, ABI subscriptions, settings, uint256 accuracy, count/parameter rules, alert/outbox persistence, replay/lease deduplication, project isolation, concurrent acknowledgement, resolution history, shallow reorg evidence, RPC failure/backoff and pause.

Frontend tests also cover CSRF re-bootstrap after login/cookie changes and input preservation after failed saves. Headless Chrome uses its own isolated profile and intercepts only `/auth/*` and `/api/*` for the review, never production application traffic. Its Vite server and browser close at the end. Screenshots are stored under `apps/web/src/features/monitoring/review/live/` and include the fourteen Figma content views/states plus empty and mobile cases.

Initial checks caught a TypeScript parameter-property restriction in the frontend, mixed component/helper exports, an overly narrow UUID type in an existing M3 test helper, and a missing numeric sort comparator. These were fixed before final passing checks. The browser harness initially intercepted source module URLs and then reported cancelled request interception IDs; its URL matching/cancellation handling were corrected. The completed review has no application runtime exceptions.

## Integration limits

- M2's current API is artifact-only. Production Add Contract correctly reports missing deployed address/ABI context until the deployed-registry adapter is configured.
- No live Sepolia RPC was supplied. Live ingestion, external reconnect behavior and real chain reorgs have not been demonstrated; protocol and worker behavior were exercised with fixtures.
- HTTP polling, 100-block batches and a twelve-block replay horizon are the supported MVP. Deeper reorg recovery, cooldowns and grouped incidents remain future work.
- M5 notification delivery is pending. M3 persists a durable outbox and does not fabricate sent notifications.
- Existing shared M5 shell differences from Figma remain; the M3 content implements the referenced layout within that shell.

## Suggested PR

Title/commit: `feat(m3): implement monitoring events and alert workflows`

Base: `dev`. Compare: `feat/monitoring-ui`. Request one team reviewer; add a real issue link if one is provided. No commit, push, or PR was created by this run.

```markdown
## Summary
Connect M3 monitoring screens to persisted watcher, event and alert workflows.

## Changes
- Implement Figma frames 62–75 as API-backed routes and resource states.
- Add watcher settings, ABI subscriptions, event evidence, typed rules and atomic alert transitions.
- Add an additive runtime migration and standalone leased-job RPC worker.
- Reuse existing authentication, CSRF, PostgreSQL pool and shared application shell.
- Document M2 deployed-registry, Sepolia RPC and M5 notification dependencies.

## Testing
- Both builds, both linters and API test-inclusive typecheck passed.
- 125 backend unit tests; 57 backend integration tests; 49 frontend tests passed.
- One optional live SMTP test skipped.
- Standalone worker and desktop/mobile browser interactions verified with disposable/test fixtures.
- Live M2/Sepolia/notification delivery and Neon migration remain pending setup.

## Checklist
- [x] Relevant tests and documentation updated
- [ ] Final changes reviewed by a team member
- [ ] Deployment migrations applied to the intended development branch
```
