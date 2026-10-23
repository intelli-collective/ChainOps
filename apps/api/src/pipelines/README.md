# M1: Pipeline & Execution

Each ChainOps project has one pipeline configuration (repository, branch, framework, checks, commands). Starting a run pins it to the **exact commit** the branch points at, queues it, and a worker builds and tests that commit in an isolated Docker container. Logs, stage results and compiled contract artifacts are stored in Neon PostgreSQL and shown in the web app (`apps/web/src/features/pipelines`).

```
GitHub branch ─▶ POST /runs ─▶ pipeline_runs + stages + pipeline_jobs (one transaction, 201 immediately)
                                         │
                       worker (SKIP LOCKED claim) ─▶ temp workspace ─▶ exact commit tarball
                                         │
                          docker: install + build ─▶ artifacts (ABI, bytecode, solc metadata)
                          docker: test             ─▶ success / failed / error / cancelled
```

Out of scope here: Slither analysis and policy decisions (Security module, M4: those stages are recorded as skipped with that reason), deployments (M2), notifications (M5), GitHub webhooks and private repositories (needs the organization GitHub integration).

## Design

| File | Role |
| --- | --- |
| `pipeline-config.*` | Configuration CRUD and validation (repository/branch are checked against GitHub when changed) |
| `pipeline-runs.controller.ts` / `.service.ts` | Runs: create (resolve branch → commit, enqueue), list, details, cancel, re-run, artifacts |
| `pipeline-worker.service.ts` | Queue consumer: claims jobs with `FOR UPDATE SKIP LOCKED`, runs stages, streams logs, heartbeats, recovers runs whose worker died, cleans up |
| `pipeline-executor.ts` | Source download, sandboxed `docker run`, artifact collection |
| `github.service.ts` / `github.controller.ts` | Public repositories (REST) and branches/commits (`git ls-remote`, no API rate limit) for the setup wizard |
| `project-lookup.controller.ts` | Interim slug → project id lookup for the web routes (replace with the M5 projects API) |
| `access-token.guard.ts` | `Authorization: Bearer <token>` or the `chainops_access` cookie (cookie writes need CSRF); validated by `AuthService.authenticate` |
| `pipeline-access.ts` | Project exists (404) and caller is a member of its organization (403), on every endpoint |
| `../../migrations/005_pipeline_execution.sql` | Additive: config columns, `pipeline_runs`, `pipeline_run_stages`, `pipeline_jobs`, `pipeline_artifacts` |

Statuses reuse the existing web vocabulary. Run: `queued`, `running`, `success`, `failed` (the project's build/tests failed), `cancelled`, `error` (the run could not execute, e.g. Docker or GitHub unavailable). Stage: `pending`, `running`, `success`, `failed`, `cancelled`, `skipped`.

### Isolation and safety

- Long work never happens in a request: `POST /runs` only writes rows and a small job.
- Each run gets a fresh temporary workspace holding the exact commit (`codeload.github.com/<repo>/tar.gz/<sha>`), deleted afterwards.
- Commands run only inside the container (`spawn` with an argument array; no host shell): no capabilities (`--cap-drop ALL`), `no-new-privileges`, memory/CPU/pid limits, unprivileged user, only the workspace mounted. No Docker socket, secrets or environment values are passed in. The container has network access so dependencies and the Solidity compiler can be downloaded.
- Artifacts are read with `lstat` (symlinks are never followed) and a size cap; logs are capped at 512 KB per stage and rendered as text only.
- A run's configuration is snapshotted when it is queued; later edits do not change it.

## API

All routes require a valid session (Bearer token or cookie) and membership of the project's organization. Errors use Nest's shape: `{"message": "...", "error": "Conflict", "statusCode": 409}`.

| Method | Path | Success | Notable errors |
| --- | --- | --- | --- |
| `POST` `GET` `PATCH` | `/projects/:projectId/pipeline` | 201 / 200 / 200 config | 400 validation or unknown repo/branch, 409 already exists |
| `GET` | `/projects/:projectId/pipeline/branches` | 200 branches of the configured repo | 404 no config |
| `GET` | `/projects/:projectId/pipeline/runs` | 200 newest first | |
| `POST` | `/projects/:projectId/pipeline/runs` `{ "branch": "main" }` | 201 queued run (exact `commitSha`) | 400 branch, 409 not configured |
| `GET` | `/projects/:projectId/pipeline/runs/:runId` | 200 run, stages with logs, failure, config snapshot | 404 |
| `POST` | `/projects/:projectId/pipeline/runs/:runId/cancel` | 200 (queued: cancelled now; running: worker stops it) | 409 already finished |
| `POST` | `/projects/:projectId/pipeline/runs/:runId/rerun` | 201 new run on the same commit | 409 still running |
| `GET` | `/projects/:projectId/pipeline/runs/:runId/artifacts[/:artifactId]` | 200 list / ABI + bytecode + metadata | 404 |
| `GET` | `/projects/:projectId/github/status`, `/repositories?owner=`, `/branches?repository=` | 200 | 404 account/repo, 502 GitHub |
| `GET` | `/pipeline-projects/lookup?ref=<slug-or-id>` | 200 `{ id, name, slug, … }` | 404 |

Configuration fields: `name`, `repository` (`owner/repo`), `branch`, `framework` (`hardhat`/`foundry`/`other`), `stages` (`checkout`, `build`, `test`, `slither`, `policy`), `buildCommand`/`testCommand` (single line, `null` = framework default), `triggers` (`push`, `pull_request`, `tag`; stored for when webhooks exist), `slitherConfig`.

## Setup

```bash
npm install
npm run db:migrate -w apps/api      # applies 005_pipeline_execution.sql
npm run start:dev -w apps/api       # API + in-process worker; Docker must be running
npm run dev:web                     # web app; /api/* is proxied to the API
```

Worker settings (all optional): `PIPELINE_WORKER=off` (API without worker), `PIPELINE_NODE_IMAGE` (default `node:22-bookworm-slim`), `PIPELINE_FOUNDRY_IMAGE` (default `ghcr.io/foundry-rs/foundry:stable`), `PIPELINE_STAGE_TIMEOUT_SECONDS` (900), `PIPELINE_MEMORY` (`2g`), `PIPELINE_CPUS` (`2`), `PIPELINE_WORKSPACE_ROOT` (OS temp dir), `GITHUB_TOKEN` (server-side only; raises the GitHub API limit for repository listing).

## Demo

Web: `/projects/chainvault/setup/repository` → pick `NomicFoundation` / `hardhat-boilerplate` / `master` → configure checks → **Run pipeline** → watch the run → Build/Test logs → Artifacts (`Token.json`, solc 0.8.17). For a failure, set the test command to `npx hardhat test test/Missing.js` and run again.

API (Postman collection: `docs/postman/ChainOps-M1-Pipelines.postman_collection.json`):

```bash
POST /projects/<projectId>/pipeline/runs  {"branch":"master"}   → 201 {"runNumber":1,"status":"queued","commitSha":"638fd58e…"}
GET  /projects/<projectId>/pipeline/runs/<runId>                → 200 {"status":"success","stages":[{"key":"build","status":"success","log":"…Compiled 2 Solidity files successfully…"}]}
```

```sql
select run_number, status, commit_sha, failure_stage from pipeline_runs where project_id = '<projectId>' order by run_number;
select key, status, left(log, 80) from pipeline_run_stages where run_id = '<runId>' order by position;
select contract_name, compiler_version from pipeline_artifacts where run_id = '<runId>';
```

## Tests

```bash
npm test -w apps/api                                    # unit: validation, stage planning, artifact capture (incl. symlink safety)
AUTH_TEST_DATABASE_URL="<direct Neon URL>" npm run test:e2e -w apps/api   # API + database + worker in a throwaway schema
```

## Known limitations

- Public GitHub repositories only, and runs start manually: the organization GitHub integration (OAuth/App, webhooks, private repositories) is platform work not yet available. Trigger settings are stored for when it is.
- Slither and Policy stages are skipped with a reason until M4 consumes pipeline runs.
- Foundry projects that rely on git submodules (e.g. `lib/forge-std`) are not supported yet: the commit tarball does not include submodules.
- The worker runs inside the API process (one run at a time). `PIPELINE_WORKER=off` plus a separate API instance as the worker scales it out; the queue already supports several workers.
- Roles/permissions (RBAC) are not implemented: any organization member can configure and run pipelines.
