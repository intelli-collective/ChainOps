# Contract artifact registry (M2 interim)

Persists artifact **metadata**, not deployed contracts. No compilation, RPC calls,
addresses, transaction hashes, deployment status, monitoring or scanning engines.
The existing frontend registry describes deployments and remains a separate mock;
it needs a later metadata-specific adapter/UI before consuming these endpoints.

## Integration and persistence

`ContractsController -> ContractsGuard/AuthService -> ContractsService -> DatabaseService -> PostgreSQL`.
The guard uses the existing JWT signature, expiration and persisted session checks.
The service checks `projects.organization_id -> organization_members.user_id` on
every operation and scopes artifact SQL to both the project and current membership.
Only a verified session supplies the user ID. Unknown body fields are rejected.
Shared `AppModule` has the minimum registration change to reuse its existing
auth/database providers; no shared auth, configuration, or frontend rewrite.

Migration: `apps/api/migrations/004_contract_artifacts.sql`. Uses UUID defaults,
TIMESTAMPTZ, a project FK with restrictive deletion, unique `(project_id,name,version)`
(case sensitive, after API whitespace trimming), a stable list index, and the existing
updated-at trigger function. The runner records applied filenames transactionally;
the new migration also tolerates replay. No Prisma or seeded runtime users.

**Confirm slot 004 with the DB owner before applying/merging.** Only local migration
files 001–003 were initially present; live schema/migration state must also be checked.
From the repository root, with the intended Neon branch credentials configured:

```bash
npm run db:migrate -w apps/api
npm run dev:api
```

The runner applies **all pending migrations**, preferring `DATABASE_URL_UNPOOLED`.
Do not run it against an unintended branch. Existing organization/project onboarding
is outside this slice; use a real existing project and organization membership.

## Postman demo: POST -> list -> detail -> Neon SELECT

Create local Postman variables `baseUrl=http://localhost:3000`, `projectId` (an
existing UUID project), and `accessToken`. Keep credentials/tokens local.

1. `GET {{baseUrl}}/auth/csrf`, capture `csrfToken` and retain the cookie jar.
2. `POST {{baseUrl}}/auth/login` with headers `Origin: http://localhost:5173`
   (use the configured `AUTH_WEB_ORIGIN`), `X-CSRF-Token: <csrfToken>`, and
   `Content-Type: application/json`; body `{"email":"<verified account>","password":"<password>"}`.
   Copy the returned `chainops_access` **cookie value** into `accessToken`.
   Login does not return a bearer token in JSON. Access tokens expire in ten minutes;
   log in again or use the existing CSRF-protected refresh endpoint to renew them.
3. On all registry requests set `Authorization: Bearer {{accessToken}}`.
   POST also needs `Content-Type: application/json`. Auth cookies have `Path=/auth`
   and alone do not authenticate registry requests. There is no demo bypass.
4. `POST {{baseUrl}}/projects/{{projectId}}/contracts`:

```json
{"name":"Vault","version":"1.0.0","framework":"hardhat","contractPath":"contracts/Vault.sol","compilerVersion":"0.8.24"}
```

Expected **201** shape (IDs/times below illustrate database-generated values):

```json
{"id":"22222222-2222-4222-8222-222222222222","projectId":"11111111-1111-4111-8111-111111111111","name":"Vault","version":"1.0.0","framework":"hardhat","contractPath":"contracts/Vault.sol","compilerVersion":"0.8.24","createdAt":"2026-10-22T00:00:00.000Z","updatedAt":"2026-10-22T00:00:00.000Z"}
```

Save the **actual** response ID as `contractId`. Optional Postman post-response script:

```javascript
pm.test('registered', () => pm.response.to.have.status(201));
pm.collectionVariables.set('contractId', pm.response.json().id);
```

5. `GET {{baseUrl}}/projects/{{projectId}}/contracts`: **200**, an array containing
   the created object, ordered by `created_at ASC, id ASC`; empty project yields `[]`.
6. `GET {{baseUrl}}/projects/{{projectId}}/contracts/{{contractId}}`: **200**, the
   same object. A valid UUID absent from this project returns **404**.
7. In the intended Neon branch SQL editor, replace both UUIDs with actual responses:

```sql
SELECT id, project_id, name, version, framework, contract_path, compiler_version,
       created_at, updated_at
FROM contract_artifacts
WHERE project_id = '<actual-project-uuid>'::uuid
  AND id = '<actual-contract-uuid>'::uuid;
```

Expect one row matching the response. This guide is a runnable demo procedure,
not a claim that a persistent Neon migration or demo has already been executed.

## Validation and errors

All five input fields are required trimmed strings. Maximum lengths: name 120,
version 80, framework 24, contractPath 512, compilerVersion 80; control characters
are rejected. Framework is `hardhat`, `foundry`, or `other`. Paths are opaque
metadata, never opened/executed. Version/compiler strings need not be semver.
No client IDs, timestamps, user IDs, addresses or status fields are accepted.

- **400**: invalid UUID or metadata (including extra fields).
- **401**: missing/malformed bearer token, invalid/expired JWT, expired/revoked session.
- **403**: existing project but caller is not an organization member.
- **404**: missing project or artifact absent from the route project.
- **409**: duplicate name/version in the same project.

Nest's standard error envelope includes `statusCode`, `message`, and `error`.
All organization members can register; role-based permissions are outside this slice.
Lists are unpaginated for the interim. Browser bearer integration requires the
shared API owner to allow `Authorization` in CORS; current shared CORS configuration
is deliberately unchanged. Postman and same-origin clients can run the demo now.

## Tests

```bash
npm test -w apps/api
npm run test:e2e -w apps/api
npm run lint -w apps/api
npm run build
```

`contracts.spec.ts` uses test-only mocked auth and DB providers to exercise HTTP
validation, statuses, SQL parameters and fail-closed behavior. Runtime has no
test guard/credential bypass. `test/contracts.e2e-spec.ts` opts in only with
`CONTRACTS_TEST_DATABASE_URL` set to a dedicated PostgreSQL/Neon **test branch**:

```bash
npm run test:e2e -w apps/api -- test/contracts.e2e-spec.ts
```

That test creates a unique schema inside a transaction, applies migrations (including
replaying 004), uses real JWT/session authentication, POST/list/detail and SELECT,
then rolls back all DDL/fixtures. It neither uses production credentials implicitly
nor persists fake users. An unset test URL means the DB test is **skipped**.

Issue-number work was skipped at the user's direction. Current working branch was
identical to local `origin/dev` at start (534aa92); remote freshness is unverified.
Before integration, reconcile with current `dev`, confirm migration order, and have
one reviewer. Commit/PR title: `feat(m2): implement contract artifact registry APIs`.
Use a verified issue-linked branch/closing reference only when the real issue is known.
No push, PR, migration application, or Neon demo is implied by this implementation.

## Changed files and validation record (2026-10-22)

- `apps/api/src/app.module.ts`: register the feature using existing shared providers.
- `apps/api/src/contracts/contracts.controller.ts`: the three UUID-scoped routes.
- `apps/api/src/contracts/contracts.guard.ts`: reuse real session authentication.
- `apps/api/src/contracts/contracts.service.ts`: membership checks and parameterized persistence.
- `apps/api/src/contracts/create-artifact.ts`: explicit metadata validation.
- `apps/api/src/contracts/contracts.spec.ts`: validation and HTTP fixture tests.
- `apps/api/src/contracts/README.md`: integration and Postman demo guide.
- `apps/api/test/contracts.e2e-spec.ts`: opt-in PostgreSQL/JWT integration test.
- `apps/api/migrations/004_contract_artifacts.sql`: additive registry table/index/trigger.

Executed from the root:

- `npm ci --ignore-scripts`: failed in the sandbox (npm/cache permissions).
- `npm ci --ignore-scripts --cache /tmp/chainops-npm-cache`: passed outside the sandbox.
- `npm test -w apps/api`: **42 passed**, including 26 registry tests. Initial sandbox
  execution failed with localhost `EPERM`; outside-sandbox rerun passed.
- `npm run test:e2e -w apps/api`: **1 passed, 18 skipped** outside the sandbox;
  initial sandbox run failed with localhost `EPERM`. Both PostgreSQL suites skipped
  because their explicit test database URLs are unset. The registry DB test has
  not been executed against PostgreSQL.
- `npm run lint -w apps/api`: passed with no warnings after fixing two new warnings.
- `npm run build`: passed (Nest API and React/Vite web); `npm run build:api` also
  passed after the final validation change.
- `npx --no-install prettier --check 'apps/api/src/contracts/*.ts' apps/api/test/contracts.e2e-spec.ts`:
  passed. The corresponding `prettier --write` command formatted these new files.
- `git diff --check`: passed.

A read-only Neon schema/history query failed with sandbox DNS restrictions, then
timed out outside the sandbox. Live compatibility and the persistent POST -> Neon
demo remain unverified. No migration apply command was executed. Confirm migration
slot/order with the DB owner, run the opt-in DB test on a dedicated test branch,
then apply the migration and perform the documented Postman/SELECT path.
