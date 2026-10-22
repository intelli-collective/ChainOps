# M3 monitoring configuration and alert rules

This slice stores intended monitoring targets and typed alert rule configuration in PostgreSQL/Neon. It does not ingest blockchain events, evaluate rules, run polling workers, send alerts, or change the existing mock monitoring frontend.

## Design and files

- `monitoring.controller.ts`: four project-scoped POST/GET routes; UUID route parsing; no-store responses.
- `monitoring-auth.guard.ts`: verifies Bearer JWTs and active sessions with the existing `AuthService.authenticate`.
- `monitoring.validation.ts`: strict request shapes, bounded names, EVM addresses, network/operator allowlists, and exact uint256 decimal strings.
- `monitoring.service.ts`: membership authorization followed by parameterized SQL in a transaction. Organization membership is locked during each operation. Results use camelCase properties and ISO timestamps over HTTP.
- `../../migrations/004_monitoring_configuration.sql`: additive tables, constraints, indexes, timestamp triggers, and a composite foreign key preventing cross-project monitor links. Migration can be re-applied; the existing runner tracks it once.
- `monitoring.validation.spec.ts` and `../../test/monitoring.e2e-spec.ts`: input tests and opt-in real PostgreSQL HTTP tests using real session verification.
- `monitoring.http`: copyable requests for the same Postman demo.

The only shared code change is registering this controller/service/guard in `app.module.ts`, so they reuse the existing database and authentication providers. No new packages, ORM, shared auth changes, or environment configuration are required.

## Prerequisites and migration

Run these commands from the repository root:

```powershell
npm.cmd install
npm.cmd run db:migrate -w apps/api
npm.cmd run dev:api
```

The migration runner uses `DATABASE_URL_UNPOOLED` (or falls back to `DATABASE_URL`) from the existing environment setup. Apply to the intended Neon development branch, and coordinate migration number `004` with the DB owner before merging if another branch has claimed it. No Neon migration has been performed by this implementation run.

You need an existing verified account, organization membership, and a project belonging to that organization. This slice does not create project/auth foundations or seed production users. Use the existing authentication/onboarding process; missing project CRUD must be integrated by its owner. The tests create fixtures only in their own isolated schema.

## Postman demo

Set `baseUrl` to `http://localhost:3000`, `webOrigin` to the configured `AUTH_WEB_ORIGIN` (normally `http://localhost:5173`), and `projectId` to an existing accessible project UUID. Use the same hostname for all requests.

1. `GET {{baseUrl}}/auth/csrf`. Keep Postman's cookie jar enabled; save the response's `csrfToken`.
2. `POST {{baseUrl}}/auth/login`, with `Origin: {{webOrigin}}`, `X-CSRF-Token: <csrfToken>`, and `Content-Type: application/json`. Body: `{"email":"YOUR_VERIFIED_EMAIL","password":"YOUR_PASSWORD"}`. Login responds with the current user and sets an HttpOnly `chainops_access` cookie.
3. In Postman's Cookies panel, copy the **value** of `chainops_access` into a local `accessToken` variable. Do not commit/export the token. This is the existing short-lived JWT, not a new demo token. It expires in ten minutes; log in again or use the existing refresh flow to obtain another.
4. For all four configuration requests, set `Authorization: Bearer {{accessToken}}`; POST requests also need `Content-Type: application/json`.

Cookies are currently scoped to `/auth`; configuration endpoints intentionally accept only Bearer authorization, not cookie or body identities. A future browser integration needs coordination with the authentication owner: the existing frontend cannot read its HttpOnly access cookie, and current CORS does not allow the Authorization header. This backend/Postman slice does not broaden those shared settings.

Create a target:

```http
POST {{baseUrl}}/projects/{{projectId}}/monitored-contracts
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{"name":"Vault Contract","network":"sepolia","address":"0x0123456789abcdef0123456789abcdef01234567"}
```

Expected **201** response (IDs and timestamps below illustrate the shape; actual values come from PostgreSQL):

```json
{
  "id": "08dc413f-0953-43bd-8acf-c5ca22d16e34",
  "projectId": "56f9f642-e29b-44bd-8503-dd5b22e57c5e",
  "name": "Vault Contract",
  "network": "sepolia",
  "address": "0x0123456789abcdef0123456789abcdef01234567",
  "createdAt": "2026-10-22T12:00:00.000Z",
  "updatedAt": "2026-10-22T12:00:00.000Z"
}
```

Save the returned `id` as `monitoredContractId`. `GET {{baseUrl}}/projects/{{projectId}}/monitored-contracts` returns **200** and an array containing that persisted object. Empty lists return `[]`.

Create a rule:

```http
POST {{baseUrl}}/projects/{{projectId}}/alert-rules
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{"name":"Large Withdrawal","monitoredContractId":"{{monitoredContractId}}","eventName":"Withdrawal","condition":{"field":"amount","operator":"gt","value":"100"},"enabled":true}
```

Expected **201** response:

```json
{
  "id": "3ad802fb-abfa-4736-bbb3-913146c9bd52",
  "projectId": "56f9f642-e29b-44bd-8503-dd5b22e57c5e",
  "monitoredContractId": "08dc413f-0953-43bd-8acf-c5ca22d16e34",
  "name": "Large Withdrawal",
  "eventName": "Withdrawal",
  "condition": {"field":"amount","operator":"gt","value":"100"},
  "enabled": true,
  "createdAt": "2026-10-22T12:00:00.000Z",
  "updatedAt": "2026-10-22T12:00:00.000Z"
}
```

`GET {{baseUrl}}/projects/{{projectId}}/alert-rules` returns **200** and an array containing the stored rule. Omit `monitoredContractId` for a project-wide rule; it returns `null`. Omit `enabled` to default to `true`.

In the Neon SQL editor connected to the **same database branch** as the API, replace `YOUR_PROJECT_UUID` and verify:

```sql
select id, project_id, name, network, address, created_at, updated_at
from monitored_contracts where project_id = 'YOUR_PROJECT_UUID'::uuid
order by created_at, id;

select id, project_id, monitored_contract_id, name, event_name, condition, enabled, created_at, updated_at
from alert_rules where project_id = 'YOUR_PROJECT_UUID'::uuid
order by created_at, id;
```

Check that the API's IDs match both tables. Restart the API and repeat both GET requests to demonstrate persistence.

## Validation and errors

Only `sepolia` is supported, matching the network represented in the current monitoring UI. The module has its own explicit allowlist because no shared network settings service exists. Update both its validation allowlist and database constraint when adding a network.

Addresses must be `0x` plus exactly 40 hexadecimal characters, stored lowercase. Mixed case is accepted and normalized; this checks address format, not EIP-55 checksums or deployed bytecode. Duplicate `(project, network, address)` returns **409** even when input case differs.

Rules permit exactly `field`, `operator`, `value` in `condition`. Field/event names are identifiers; operators are `eq`, `gt`, `gte`, `lt`, `lte`. This interim implementation accepts only unsigned integer thresholds from `0` through `2^256-1`, encoded as canonical decimal **strings**. Numbers, floats, signs, exponents, executable expressions, unknown properties, and out-of-range values return **400**. ABI field existence and real event processing are future work.

Malformed UUIDs/inputs return **400**, missing/invalid/expired/revoked Bearer sessions **401**, inaccessible or missing projects **404** (the same response to conceal other organizations), and monitor links outside the project **404**. The auth login route can return **403** for CSRF/email verification errors. Standard Nest error responses contain `statusCode`, `message`, and `error`. No input `userId`, IDs, or timestamps are trusted.

## Verification

See [the implementation run's verification results](VERIFICATION.md) for executed commands and outcomes.

```powershell
npm.cmd run build:api
npm.cmd test -w apps/api
npm.cmd run lint -w apps/api
# Use a disposable/local PostgreSQL database with schema-create permission:
$env:MONITORING_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE'
npm.cmd run test:e2e -w apps/api
npm.cmd run build:web
```

The monitoring PostgreSQL suite explicitly skips unless `MONITORING_TEST_DATABASE_URL` is set. It creates a unique schema, applies migrations (including re-applying `004`), exercises actual HTTP routes with real JWT/session authentication, verifies database rows and constraints, and removes its own test schema. It covers POST/GET cycles, duplicate addresses, malformed inputs, unsafe rules, cross-organization/project isolation, revoked sessions, and membership removal. Use a disposable test database; do not point the test URL at production.

## Integration handoff

Per the user's instruction, work stays on `feat/m3-monitoring-backend01`; there is no issue number. No issue number, commit, push, or PR is fabricated. Integrate against `dev` after coordinating the migration filename and reviewing shared `app.module.ts` registration. Suggested conventional commit/PR title: `feat(m3): implement monitoring configuration and alert rule APIs`. Request one reviewer and add the actual issue link if an issue is created later.
