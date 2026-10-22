# M4 security governance API demo

This is the interim persisted API slice. A stored security policy is configuration, **not** a Slither scan, policy evaluation, or automatic deployment block. An approval request starts at `PENDING`; it is **not** an approval or deployment authorization.

## Prerequisites and migration

Use a database branch approved by the DB owner. The current repository applies numbered `apps/api/migrations/*.sql` files in order and records each applied filename in `schema_migrations`. Migration `004_security_governance.sql` adds the M4 tables. The runner uses `DATABASE_URL_UNPOOLED` when present, otherwise `DATABASE_URL`, and may apply **all** pending migrations. Confirm the target and migration order with the DB owner before running, from the repository root:

```powershell
npm run db:migrate -w apps/api
```

Do not run this against a shared or production Neon branch without coordination. Do not reset or seed it for this demo. At the time this guide was written, M4 migration application and live Neon persistence were **not verified**.

The API requires `DATABASE_URL`, `AUTH_JWT_SECRET` (at least 32 bytes), and `AUTH_WEB_ORIGIN` in the ignored root `.env.local` or deployment environment. The migration should use a direct `DATABASE_URL_UNPOOLED`. For local HTTP only, set `AUTH_COOKIE_SECURE=false`; production requires Secure cookies and HTTPS. An existing **email-verified** user must have an active session and an `organization_members` row for the organization owning the chosen project. Obtain that project's UUID from the shared DB owner or an authorized read-only query; `/auth/me` returns the user and organizations, not project IDs. SMTP is needed to register/verify a new email account, but not to log in with an existing verified account. Never store credentials or connection strings in this guide or a committed Postman environment.

Start the API from the repository root with `npm run dev:api`. It listens on `PORT` if set, otherwise port **3000**, and has **no global `/api` prefix**. For the default local port, set Postman's `baseUrl` to `http://localhost:3000`. The current Vite development proxy covers `/auth` only; use the direct API URL for `/projects` requests in Postman. A future browser integration must route `/projects` to the API or call its origin with credentials.

## Postman environment and sign-in

Create these local Postman variables without exporting secrets into the repository:

| Variable | Value |
| --- | --- |
| `baseUrl` | API origin, for example `http://localhost:3000` when `PORT` is unset |
| `webOrigin` | Exact configured `AUTH_WEB_ORIGIN`; use this as the `Origin` header on POSTs |
| `projectId` | UUID of a project whose organization includes the signed-in user |
| `csrfToken` | Value returned by `GET /auth/csrf` |

Enable Postman's cookie jar and use the **same host** throughout. The API uses HttpOnly cookies, not a Bearer token or `x-user-id`. The access and CSRF cookies have path `/`; the refresh cookie remains scoped to `/auth`. Postman must retain both cookies. For every POST below, set `Origin: {{webOrigin}}`, `X-CSRF-Token: {{csrfToken}}`, and `Content-Type: application/json`. GETs need the access cookie but no CSRF header.

1. `GET {{baseUrl}}/auth/csrf` → `200`; copy response `csrfToken` to the Postman variable. The cookie jar also receives `chainops_csrf`.
2. `POST {{baseUrl}}/auth/login` with the POST headers above and a verified account's credentials:

   ```json
   { "email": "<verified-account-email>", "password": "<password>" }
   ```

   Expect `201`; the cookie jar receives `chainops_access` and `chainops_refresh`. Do not copy cookie values into a committed file.
3. `GET {{baseUrl}}/auth/me` → `200`; confirm the returned user and organization membership. Check that `projectId` belongs to one of those organizations before the M4 requests.

If the access token expires during the demo, `POST {{baseUrl}}/auth/refresh` with the same Origin/CSRF headers and cookie jar rotates the session tokens. Re-run `/auth/csrf` if the CSRF token or cookie is missing.

## Policy create → list

4. `POST {{baseUrl}}/projects/{{projectId}}/security-policies` with the POST headers and body:

   ```json
   {
     "name": "Production Release Gate",
     "blockCritical": true,
     "blockHigh": true,
     "requireApproval": true
   }
   ```

   Expect `201` and a response like:

   ```json
   {
     "id": "<policy-uuid>",
     "projectId": "<project-uuid>",
     "name": "Production Release Gate",
     "blockCritical": true,
     "blockHigh": true,
     "requireApproval": true,
     "createdAt": "<ISO-8601-timestamp>",
     "updatedAt": "<ISO-8601-timestamp>"
   }
   ```

5. `GET {{baseUrl}}/projects/{{projectId}}/security-policies` → `200` array. Find the same policy UUID and fields. Results are ordered by `created_at DESC, id DESC` and scoped to `projectId`.

## Approval request create → list

6. `POST {{baseUrl}}/projects/{{projectId}}/approval-requests` with the POST headers and body:

   ```json
   {
     "title": "Approve Vault v1.0 release",
     "description": "Requesting approval for testnet deployment"
   }
   ```

   Expect `201` and a response like:

   ```json
   {
     "id": "<request-uuid>",
     "projectId": "<project-uuid>",
     "title": "Approve Vault v1.0 release",
     "description": "Requesting approval for testnet deployment",
     "requestedById": "<authenticated-user-uuid>",
     "status": "PENDING",
     "createdAt": "<ISO-8601-timestamp>",
     "updatedAt": "<ISO-8601-timestamp>"
   }
   ```

   `requestedById` comes from the verified session, never the request body. The database supplies the `PENDING` default and constrains this interim table to that status. `PENDING` does **not** mean approved.
7. `GET {{baseUrl}}/projects/{{projectId}}/approval-requests` → `200` array. Find the same request UUID, requester ID, and `PENDING` status. Results are ordered by `created_at DESC, id DESC` and scoped to `projectId`.

## Negative checks

Use a valid session and CSRF header unless the check deliberately omits them:

- `GET {{baseUrl}}/projects/not-a-uuid/security-policies` → `400`.
- `GET {{baseUrl}}/projects/{{projectId}}/approval-requests` without the access cookie → `401`.
- Either project route with an authenticated user who is not in that project's organization → `403`; a nonexistent project UUID → `404`.
- Policy POST with `"blockHigh": "true"` or `"name": "   "` → `400`.
- Approval POST with `"title": "   "`, `"status": "APPROVED"`, `"requestedById": "<other-uuid>"`, or `"decision": "APPROVED"` → `400`. Unknown fields are rejected rather than stripped; no approval row is created.
- Either M4 POST without the matching Origin and CSRF cookie/header → `403`.

## Read-only Neon verification

After the API demo, open the **same approved Neon branch** in its SQL editor. Replace `<project-id>` with the demo UUID. These are verification steps, **not completed evidence**:

```sql
SELECT name, applied_at
FROM schema_migrations
WHERE name = '004_security_governance.sql';

SELECT id, project_id, name, block_critical, block_high, require_approval, created_at, updated_at
FROM security_policies
WHERE project_id = '<project-id>'::uuid
ORDER BY created_at DESC, id DESC;

SELECT id, project_id, title, description, requested_by_id, status, created_at, updated_at
FROM approval_requests
WHERE project_id = '<project-id>'::uuid
ORDER BY created_at DESC, id DESC;
```

Match the two row UUIDs and persisted fields with the POST and GET responses. A stored policy is not a scan or policy decision. This feature has no Slither execution, automatic policy evaluation or deployment block, approve/reject endpoint, reviewer RBAC, deployment authorization, or blockchain transaction.
