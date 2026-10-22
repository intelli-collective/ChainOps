# M1: Pipeline configuration API

Each ChainOps project can store **one** pipeline configuration: name, GitHub repository, branch, framework and an ordered list of stages. The API creates, reads and updates it; data is persisted in Neon PostgreSQL (`pipeline_configs`).

**Interim scope.** This stores configuration metadata only. Nothing here runs a pipeline, executes commands, calls GitHub, registers webhooks, uses tokens, creates pipeline runs, deploys contracts or scans code. Those belong to later M1 work.

## Design

`PipelineConfigController` → `PipelineConfigService` → `DatabaseService` (`pg` pool) → `pipeline_configs`

| File | Role |
| --- | --- |
| `pipeline-config.controller.ts` | Routes; `ParseUUIDPipe` on `:projectId`; acting user comes only from the verified token |
| `access-token.guard.ts` | `Authorization: Bearer <access token>`, verified by the existing `AuthService.authenticate` (JWT + live, unrevoked session). Fails closed with 401 |
| `pipeline-config.validation.ts` | Body validation (allowlisted fields, repo/branch shape, framework, stage allowlist) → 400 |
| `pipeline-config.service.ts` | Project existence (404) and organization membership (403) on every call; parameterized SQL; 409 on duplicate |
| `../../migrations/004_pipeline_configs.sql` | Additive table, unique `project_id` FK, CHECK constraints, `updated_at` trigger |

## API

All routes require `Authorization: Bearer <access token>` and membership of the project's organization.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| `POST` | `/projects/:projectId/pipeline` | `201` created config | `400` invalid body/UUID, `401`, `403` not a member, `404` project, `409` already exists |
| `GET` | `/projects/:projectId/pipeline` | `200` config | `400` UUID, `401`, `403`, `404` project or config |
| `PATCH` | `/projects/:projectId/pipeline` | `200` updated config | `400`, `401`, `403`, `404` project or config |

Errors use Nest's standard shape: `{"message": "...", "error": "Forbidden", "statusCode": 403}`.

**Fields** (unknown fields are rejected; `id`, `projectId` and timestamps are set by the backend):

| Field | Create | Rule |
| --- | --- | --- |
| `name` | required | non-empty, ≤ 120 characters |
| `repository` | required | GitHub `owner/repo` (no URL, no `.git`) |
| `branch` | required | non-empty git branch name (`[A-Za-z0-9._/-]`, no `..`, no leading `-`) |
| `framework` | optional | `hardhat`, `foundry` or `other` (same as `projects.framework`); defaults to the project's framework |
| `stages` | required | non-empty, no duplicates, each one of `checkout`, `compile`, `build`, `test`, `security`, `slither`, `policy` |

`PATCH` accepts any non-empty subset of these fields. Timestamps are `TIMESTAMPTZ` in PostgreSQL and ISO 8601 strings in responses.

## Setup

```bash
npm install
npm run db:migrate -w apps/api   # applies 004_pipeline_configs.sql (skips migrations already applied)
npm run build -w apps/api
npm run start:dev -w apps/api    # needs AUTH_WEB_ORIGIN and AUTH_JWT_SECRET (≥ 32 bytes) in .env.local
```

## Postman demo

**1. A member account.** You need a verified account that belongs to the project's organization. Organization onboarding is not built yet, so add the membership once in the Neon SQL editor (replace the email; ChainVault belongs to `chainops-team`):

```sql
insert into organization_members (organization_id, user_id)
select o.id, u.id from organizations o, users u
where o.slug = 'chainops-team' and u.email = 'you@example.com'
on conflict do nothing;
```

**2. Get an access token** with the existing auth endpoints (Postman keeps the cookies between requests):

1. `GET http://localhost:3000/auth/csrf` → copy `csrfToken` from the response.
2. `POST http://localhost:3000/auth/login` with headers `Origin: <AUTH_WEB_ORIGIN>` and `X-CSRF-Token: <csrfToken>`, body `{"email": "...", "password": "..."}`.
3. From the response cookies, copy the value of `chainops_access`. It is valid for 10 minutes; repeat step 2 for a new one.

**3. Find a real project ID:**

```sql
select p.id, p.name, o.slug from projects p join organizations o on o.id = p.organization_id;
```

**4. POST → GET → PATCH → GET** with header `Authorization: Bearer <chainops_access>` (see `pipeline-config.http`):

```http
POST /projects/05d2496e-5fa4-4d7a-9606-7dd98d154e4b/pipeline
Content-Type: application/json

{"name":"Smart Contract CI","repository":"intelli-collective/vault-contracts","branch":"main","framework":"hardhat","stages":["compile","test","security"]}
```

```json
201 Created
{"id":"67ee200a-c2e2-489a-b7cb-fb12fe2502cc","projectId":"05d2496e-5fa4-4d7a-9606-7dd98d154e4b","name":"Smart Contract CI","repository":"intelli-collective/vault-contracts","branch":"main","framework":"hardhat","stages":["compile","test","security"],"createdAt":"2026-10-22T15:33:11.391Z","updatedAt":"2026-10-22T15:33:11.391Z"}
```

`GET` returns the same body with `200`. A second `POST` returns:

```json
409 Conflict
{"message":"This project already has a pipeline configuration; use PATCH to change it","error":"Conflict","statusCode":409}
```

```http
PATCH /projects/05d2496e-5fa4-4d7a-9606-7dd98d154e4b/pipeline
Content-Type: application/json

{"branch":"develop","stages":["checkout","compile","test","slither"]}
```

```json
200 OK
{"id":"67ee200a-c2e2-489a-b7cb-fb12fe2502cc","projectId":"05d2496e-5fa4-4d7a-9606-7dd98d154e4b","name":"Smart Contract CI","repository":"intelli-collective/vault-contracts","branch":"develop","framework":"hardhat","stages":["checkout","compile","test","slither"],"createdAt":"2026-10-22T15:33:11.391Z","updatedAt":"2026-10-22T15:33:15.080Z"}
```

**5. Verify in Neon:**

```sql
select id, project_id, name, repository, branch, framework, stages, created_at, updated_at
from pipeline_configs
where project_id = '05d2496e-5fa4-4d7a-9606-7dd98d154e4b';
```

## Tests

```bash
npm test -w apps/api                       # unit: validation rules
AUTH_TEST_DATABASE_URL="<direct Neon URL>" \
  npm run test:e2e -w apps/api             # integration: real HTTP + PostgreSQL in a throwaway schema
```

The integration suite (`test/pipeline-config.e2e-spec.ts`) applies migrations 001–004 to a uniquely named schema, uses real sessions from `AuthService.createSession`, and drops the schema afterwards. It covers create + GET, PATCH + GET, duplicate 409, invalid stage/body 400, missing token 401, non-member 403 on every route, missing project/config 404, and the database-level one-config-per-project constraint.

## Known limitations

- **Browser clients cannot call these routes yet.** The auth cookies are scoped to `path=/auth` and are HttpOnly, and CORS only allows `Content-Type` and `X-CSRF-Token`. The web app needs the auth owner to expose the session to `/projects` (cookie path plus CSRF) or allow `Authorization`. Postman and server-side clients work today.
- **Membership only.** Any member of the organization may create or edit the configuration; roles and permissions (RBAC) are not implemented yet.
- **No organization or project CRUD yet**, hence the SQL step above.
- One configuration per project, no delete endpoint and no history of earlier versions.
