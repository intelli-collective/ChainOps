# ChainOps authentication

Member 5 authentication uses the existing `DatabaseService` / node-postgres pool, users and tenancy tables, npm workspaces, and numbered SQL migrations. It does not use Neon Auth as a second identity/session store. `NEON_AUTH_*` variables are not needed by these endpoints. GitHub OAuth sign-in requests only user/profile email scopes and is independent of future GitHub App installation/repository integration.

## Setup and dependencies

The configured Neon connection and original five public tables were verified. `002_authentication.sql` has been validated in an isolated schema and rolled back; it has **not** been applied to production. Before running the app, point the existing database variables at the intended development branch, review the migration, then run `npm run db:migrate -w apps/api`. Never reset or reseed production for authentication.

Use [authentication.env.example](authentication.env.example) for the complete variable list. Keep actual values in the ignored root `.env.local` or deployment secret store. Never use `VITE_` variables for secrets. `AUTH_JWT_SECRET` must contain at least 32 random bytes; generate a value with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Configure `AUTH_WEB_ORIGIN` to the exact frontend origin. Production requires HTTPS and `AUTH_COOKIE_SECURE=true`; SameSite defaults to `lax`. `none` requires Secure cookies. No cookie Domain is set. Keep the frontend and API auth routes on one public origin; proxy `/auth` to Nest in production as Vite does locally. Cookies are HttpOnly with path `/auth`; tokens never enter localStorage or JavaScript responses. The OAuth binding cookie always uses Lax for top-level provider callbacks.

At implementation time the auth signing key, origin, SMTP sender/transport, and Google/GitHub configuration were absent. The API deliberately fails startup without signing/origin configuration. Registration and verification resend return 503 when `AUTH_SMTP_URL` or `AUTH_EMAIL_FROM` is absent. Supply a real SMTP service or a local SMTP capture server for development; no email is marked verified merely because delivery is unavailable. SMTP delivery errors leave an unverified account eligible for resend. Existing users retain their credentials but are not marked email-verified by migration; use resend to verify ownership. Seeded placeholder hashes are not real login credentials.

Start `npm run dev:api` and `npm run dev:web` in separate terminals after configuring the environment and applying migrations. The Vite `/auth` proxy targets port 3000; keep the API there locally or update that proxy alongside `PORT`. The existing root `.env.example` deletion was left untouched.

## OAuth applications locally

Google: create a **Web application** OAuth client in Google Cloud Console, enable/configure the consent screen, and add your test users if the app is in testing. Register `http://localhost:5173/auth/google/callback` as an exact authorized redirect URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` on the backend. Scope is `openid email profile`. The server checks signature, RS256 algorithm, issuer, audience, token age/expiry, nonce and verified email. See [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

GitHub: Settings → Developer settings → OAuth Apps → New OAuth App. Use `http://localhost:5173` as the homepage and `http://localhost:5173/auth/github/callback` as the authorization callback. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL`. Create an OAuth App, separately from any future GitHub App. Both providers use authorization code + S256 PKCE and browser-bound, expiring, single-use state. GitHub requires a verified primary email retrieved from `/user/emails`. See [GitHub authorization flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

Use exact HTTPS callback URLs for production and separate provider clients from development. Provider tokens are discarded after identity lookup. Identities are matched only by `(provider, subject)`. A matching email on another account causes a safe failure; explicit account linking is outside this issue. Provider failures return a generic login error without provider tokens or detailed errors in the URL. Automated tests mock external responses. **Neither live provider flow has been manually verified with real client credentials.**

## Persistence and session rules

Migration 002 allows null legacy `users.password_hash`, adds nullable `email_verified_at`, copies existing hashes to `password_credentials`, and backfills local identities. It preserves the original column and existing data. New local passwords are Argon2id (64 MiB, three iterations, parallelism one); OAuth-only users have no credential. The migration adds `auth_identities` with provider/subject and user/provider uniqueness, `auth_sessions`, hashed rotating `refresh_tokens`, hashed single-use `email_verifications`, `oauth_attempts`, and shared database rate-limit counters. Foreign keys cascade from users; all changes run through the existing transactional migration runner.

Access JWTs expire after ten minutes and are verified with an explicit algorithm/issuer/audience. Every authenticated request also checks the server session, so revocation takes effect immediately. Refresh tokens are 256-bit opaque random values; only SHA-256 hashes are persisted. Rotation locks the session/token rows, consumes the old token, and inserts a replacement. Reusing a consumed token commits revocation of its session before returning 401. Sessions expire absolutely after 30 days. Logout revokes the current session; revoke-all invalidates every session for the user. Consumed refresh hashes must remain until session expiry so reuse is detectable.

The frontend shares an in-flight refresh within a tab. Browsers supporting Web Locks also coordinate across tabs and recheck cookies after acquiring the lock. Browsers without Web Locks retain per-tab coordination; simultaneous refreshes across such tabs can trigger strict replay revocation and require sign-in again.

All state-changing endpoints require an exact Origin match and a double-submit CSRF token obtained from `/auth/csrf`. The CSRF cookie is HttpOnly; its value is returned by the non-cacheable bootstrap endpoint and held only in memory. CORS allows only the configured frontend origin with credentials. Rate limits allow 20 attempts per action/IP per 15 minutes and store hashed IP keys in PostgreSQL. When deploying behind a proxy, configure trusted proxy behavior only for the actual proxy topology; do not trust arbitrary forwarded IP headers. Apply upstream request/concurrency limits as appropriate for password hashing capacity.

Operations should periodically remove expired OAuth attempts, verification records and rate-limit rows, and expired sessions (cascading to their refresh hashes). Never remove consumed refresh hashes belonging to unexpired sessions. No scheduler or unrelated infrastructure has been introduced.

## API

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/auth/csrf` | Issue/reuse CSRF cookie and return its value |
| POST | `/auth/register` | Validate, save unverified account, send email; no session |
| POST | `/auth/login` | Require verified email/password; set cookies and return safe profile |
| GET | `/auth/me` | Protected current user, memberships, and next route |
| POST | `/auth/refresh` | Rotate refresh token and access JWT |
| POST | `/auth/logout` | Revoke current session and clear cookies |
| POST | `/auth/sessions/revoke` | Require access JWT, revoke all user sessions |
| POST | `/auth/verify-email` | Consume verification token from JSON body |
| POST | `/auth/verification/resend` | Generic response; resend if eligible |
| GET | `/auth/google/start`, `/auth/github/start` | Begin provider authorization |
| GET | `/auth/google/callback`, `/auth/github/callback` | Validate callback and establish session |

Local registration returns a verification notice. Verification links put the token in a fragment, which the existing frontend origin handles without including it in server access logs. Confirmation requires an explicit button and POST. After verification, first sign-in sends users without memberships to `/onboarding` (the existing setup placeholder). Returning members go to the existing `/projects` overview placeholder. Neither path creates organizations. Organization/project CRUD and authorization of future server-backed module endpoints remain separate work; a frontend route guard is not a substitute for backend authorization. Unrelated feature modules remain mock-driven.

## Checks

Run `npm run lint -w apps/api`, `npm run lint -w apps/web`, `npm run build`, `npm run test -w apps/api`, `npm run test:auth -w apps/web`, `npm run test:security -w apps/web` and `npm run test:e2e -w apps/api`. Builds include TypeScript checking; the API was also checked with `npm exec -w apps/api -- tsc --noEmit` to include test files. PostgreSQL auth integration tests explicitly opt in using `AUTH_TEST_DATABASE_URL`, a **direct** connection URL. They create a unique test schema, mock SMTP, and drop the schema in teardown. Without this variable the database suite is reported skipped. Prefer a dedicated Neon test branch. `node --env-file=../../.env.local scripts/check-auth-migration.mjs` from `apps/api` validates migration DDL, legacy credential preservation and passwordless users in an isolated schema inside a fully rolled-back transaction.

Unit tests mock provider HTTP responses and Google JWT verification at the protocol boundary; real signature/claim enforcement is delegated to `jose` with explicit verification options. Integration tests exercise real PostgreSQL constraints, Argon2id, JWTs, email token consumption, rotations, replay revocation, expired sessions, logout, HTTP cookies/CSRF, memberships and rate limits. Real SMTP delivery and live Google/GitHub callbacks remain manual checks after configuration.

Validated on 2026-10-22: both workspace builds and linters passed, API test-inclusive TypeScript checking passed, 15 API unit tests passed, 12 API integration/e2e tests passed with the direct Neon URL and isolated schemas, 10 frontend auth tests passed, and all 24 existing security frontend tests passed. Migration preservation checks and `git diff --check` passed. `npm audit --omit=dev` reported zero runtime advisories; installation reported five advisories when development dependencies were included. Initial sandbox network failures were resolved with approved execution. The pooled connection rejected test-schema startup options; integration tests passed using the direct URL. No production application data or migration history was changed, and no test schemas remain.
