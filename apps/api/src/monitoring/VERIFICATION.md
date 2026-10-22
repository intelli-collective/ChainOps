# M3 verification — 22 October 2026

Branch: `feat/m3-monitoring-backend01`, retained at the user's explicit request. No issue number, commit, push, or PR was created. No Neon database was contacted or migrated.

Environment: Windows, Node.js `v24.14.0`, npm `11.9.0`, isolated local PostgreSQL `18.3` listening on `127.0.0.1:55439`. No production database or existing local database was used. The temporary server was stopped after verification.

## Final checks

Commands below were run from the repository root:

| Command | Result |
| --- | --- |
| `npm.cmd run build:api` | PASS |
| `npm.cmd run lint -w apps/api` | PASS, no warnings after fixing the control-character check |
| `npm.cmd test -w apps/api` | PASS, 55 tests across 4 files |
| `npm.cmd run test:e2e -w apps/api` | PASS, 28 tests across 3 files; 1 existing optional live Mailpit/SMTP test skipped |
| `npm.cmd run test:e2e -w apps/api -- monitoring.e2e-spec.ts` | PASS, all 11 monitoring HTTP/PostgreSQL tests; rerun after final validation change |
| `npm.cmd run build:web` | PASS |
| `npm.cmd run db:migrate -w apps/api` | PASS on disposable local PostgreSQL; applied migrations 001–004 |
| `npm.cmd run db:migrate -w apps/api` (second run) | PASS, migrations already up to date |
| `git -c safe.directory='D:/Software  Project/CodeBase/ChainOps' diff --check` | PASS |

Database variables were set only for their respective command processes:

```powershell
# Full integration suite (real auth sessions + monitoring + existing app test):
$env:MONITORING_TEST_DATABASE_URL = 'postgresql://monitoring_test@127.0.0.1:55439/postgres'
$env:AUTH_TEST_DATABASE_URL = $env:MONITORING_TEST_DATABASE_URL
npm.cmd run test:e2e -w apps/api

# Final focused rerun:
$env:MONITORING_TEST_DATABASE_URL = 'postgresql://monitoring_test@127.0.0.1:55439/postgres'
npm.cmd run test:e2e -w apps/api -- monitoring.e2e-spec.ts

# Migration runner (executed twice against the temporary local server):
$env:DATABASE_URL_UNPOOLED = 'postgresql://monitoring_test@127.0.0.1:55439/postgres'
npm.cmd run db:migrate -w apps/api
npm.cmd run db:migrate -w apps/api
```

The M3 integration suite used the production controller, service, guard, real `AuthService` JWT/session validation, and PostgreSQL. It checked both POST → GET → SQL verification cycles; case-insensitive duplicate prevention; exact maximum uint256 storage; malformed inputs and unsafe operators; organization isolation across all routes; same-project monitor links enforced by API and composite foreign key; session revocation; and membership removal. The new SQL migration was reapplied within the suite to verify idempotence.

An additional native `psql` transaction applied migrations 001–004 and reapplied 004, then rolled back the entire validation schema successfully. API-level test schemas were removed by their test teardown.

## Setup failures resolved during the run

- The first `npm.cmd run build:api` failed because declared dependencies (`argon2`, `jose`, `nodemailer`, `pg`, and `cookie-parser`) were missing from the local installation.
- `npm.cmd ci --no-audit --no-fund` failed with Windows `EPERM` on an in-use Rolldown native binding.
- `npm.cmd install --no-audit --no-fund --cache 'D:\Software  Project\CodeBase\.npm-cache'` initially failed because sandbox networking blocked npm registry downloads. The same command succeeded with approved network access. It emitted existing engine-version and native-file cleanup warnings. Package manifests and lockfiles were unchanged.
- The first lint run warned about an intentional control-character regular expression. The validation now checks character codes instead, and the final lint run passed without warnings.
- Docker was unavailable. Installed native PostgreSQL binaries provided the isolated test database instead. `pg_ctl start` could not create a restricted Windows token; launching `postgres.exe` directly succeeded.

## Remaining integration work

Apply migration 004 to the intended Neon development branch with the existing environment configuration, then execute the Postman demo and Neon SELECTs in [README.md](README.md). This workspace has no configured Neon connection, so no claim of Neon verification is made.

Coordinate the migration filename with the database owner and integrate the minimal `app.module.ts` registrations into `dev`. Existing project and membership records are prerequisites. Browser integration needs an agreed way to authorize project endpoints: current access cookies are HttpOnly and scoped to `/auth`, and shared CORS currently does not permit Authorization. This backend task leaves that auth-owner change and frontend integration for coordination. The current monitoring dashboard continues to show explicitly mocked event data; this API stores configuration only.
