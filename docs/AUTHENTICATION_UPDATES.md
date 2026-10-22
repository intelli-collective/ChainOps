# Authentication recovery and visual update

Changed: shared ChainOps auth layout, logo/orbit artwork, scoped color tokens, responsive fields, polished disabled provider buttons, eight-character password minimum, real forgot/reset pages, consistent verification UI, form clearing on login entry/browser restoration and logout notifications for protected routes. No organization/project features were added. The existing SMTP transport, database pool, migration runner and session implementation are reused.

New migration: `apps/api/migrations/003_password_resets.sql`. It adds hashed, expiring recovery tokens and indexes. It is additive. Existing password hashes and account verification status are preserved. Only a successful reset changes that user's password and revokes their sessions. Reset tokens are single-use, expire after 30 minutes and are not printed or persisted raw.

Run from the repository root after reviewing your database target:

```powershell
npm.cmd run db:migrate -w apps/api
npm.cmd run dev:api
# In a separate terminal:
npm.cmd run dev:web
```

Use your existing Mailpit configuration. No new secrets or dependencies are needed. Restart the API if it is not already watching for changes. Do not run a schema reset or seed.

Manual review:

1. Register with an eight-character password; seven characters must fail. Check registration, verify the received Mailpit link and sign in. Before verification, sign-in must fail.
2. Request verification resend and check its link. Invalid/used verification links must show an error.
3. Choose **Forgot password?**, submit your registered email, open the reset email from Mailpit and choose a matching new password of at least eight characters. A mismatch must fail.
4. Confirm the old password no longer works and the new password does. Existing signed-in sessions must be rejected after reset. Reusing the link must fail.
5. Submit an unknown address and confirm it receives the same generic response. A missing/malformed reset link must show a recovery error. Automated tests cover a database-expired token; do not wait 30 minutes or alter real user data just to test expiry.
6. Log out, use Back and refresh a protected URL. The login page must appear with empty app-controlled fields. Independently saved browser/password-manager suggestions may still be offered; the app cannot delete a browser's password vault. Remove saved credentials in browser settings if desired.
7. Check login, register, forgot/reset and verification screens at desktop and phone widths. Provider buttons must be visible, disabled and labeled Coming soon. No OAuth request should start.

Remaining: approved legal documents, live production SMTP/HTTPS configuration and future provider enablement. Google/GitHub backend code is retained, but provider UI is deliberately disabled for this task. Never treat browser route guards as authorization for future server-backed modules.

Files changed:

- API: `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.service.spec.ts`, `test/auth.e2e-spec.ts`, `scripts/check-auth-migration.mjs`.
- Web: `src/App.css`, `src/App.tsx`, `src/app/layouts/ApplicationLayout.tsx`, existing auth `AuthPage.tsx`, `Session.tsx`, `api.ts`, their tests and README.
- Documentation: `docs/AUTHENTICATION.md` and this handoff.

Files added:

- `apps/api/migrations/003_password_resets.sql`.
- `apps/web/src/features/auth/AuthLayout.tsx`, `AuthControls.tsx`, `authUtils.ts`, `RecoveryPage.tsx`, `RecoveryPage.ui.spec.tsx`.
- `apps/web/public/chainops-auth-artwork.jpeg` (the supplied image, copied without bitmap edits).
- `docs/AUTHENTICATION_UPDATES.md`.

Removed: the unused `apps/web/src/features/auth/EthereumArtwork.tsx`. The existing root `.env.example` deletion was present before this work and remains untouched. Real environment files are not staged or changed.

Checks actually run: 16 API unit tests, 18 API integration/e2e tests (including actual local Mailpit delivery), 17 frontend auth tests and all 24 existing security tests passed. Both builds, linters, API test-inclusive TypeScript checking, migration preservation and whitespace checks passed. Headless Chrome reviewed all five auth screens at 1440×900, 1366×768 and 375×812: no horizontal overflow, desktop feature content visible, provider buttons disabled, login fields empty after reload and no app browser-storage entries. Desktop and mobile screenshots were visually inspected. Application migration 003 remains pending; the checks used temporary schemas and did not migrate application tables.
