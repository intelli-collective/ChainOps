-- M1: pipeline execution. Additive only: extends pipeline_configs and adds
-- runs, stages, a database-backed job queue and build artifacts.

-- Build & test settings shown on the pipeline configuration screens.
-- Null commands mean "use the framework default" (resolved by the API).
alter table pipeline_configs add column if not exists build_command varchar(300);
alter table pipeline_configs add column if not exists test_command varchar(300);
alter table pipeline_configs add column if not exists triggers jsonb not null default '["push", "pull_request"]';
alter table pipeline_configs add column if not exists slither_config varchar(200);
do $$ begin
  alter table pipeline_configs add constraint pipeline_configs_triggers_check
    check (jsonb_typeof(triggers) = 'array');
exception when duplicate_object then null; end $$;

create table if not exists pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  run_number integer not null,
  status varchar(16) not null default 'queued'
    check (status in ('queued', 'running', 'success', 'failed', 'cancelled', 'error')),
  trigger varchar(16) not null check (trigger in ('manual', 'push', 'pull_request')),
  triggered_by uuid references users (id) on delete set null,
  repository varchar(140) not null,
  branch varchar(255) not null,
  -- Exact source revision resolved when the run is created, never a moving branch head.
  commit_sha char(40) not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  rerun_of uuid references pipeline_runs (id) on delete set null,
  -- Commands, stages and framework as they were when the run was queued.
  config_snapshot jsonb not null,
  failure_stage varchar(16),
  failure_reason text,
  cancel_requested_at timestamptz,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_runs_project_number_key unique (project_id, run_number)
);
create index if not exists pipeline_runs_project_queued_idx on pipeline_runs (project_id, queued_at desc);

create table if not exists pipeline_run_stages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references pipeline_runs (id) on delete cascade,
  key varchar(16) not null check (key in ('checkout', 'build', 'test', 'slither', 'policy')),
  position smallint not null,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')),
  -- Plain-text output; rendered as text, never as HTML.
  log text not null default '',
  skip_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  constraint pipeline_run_stages_run_key unique (run_id, key)
);

-- Database-backed queue: the API inserts one small job per run; workers claim
-- jobs with FOR UPDATE SKIP LOCKED, so a job is processed by one worker only.
create table if not exists pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references pipeline_runs (id) on delete cascade,
  status varchar(16) not null default 'queued' check (status in ('queued', 'claimed', 'done')),
  attempts smallint not null default 0,
  locked_by varchar(120),
  heartbeat_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pipeline_jobs_queued_idx on pipeline_jobs (created_at) where status = 'queued';

create table if not exists pipeline_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references pipeline_runs (id) on delete cascade,
  contract_name varchar(200) not null,
  source_path varchar(500) not null,
  artifact_path varchar(500) not null,
  abi jsonb not null,
  bytecode text not null,
  deployed_bytecode text not null,
  compiler_version varchar(80),
  build_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint pipeline_artifacts_run_contract_key unique (run_id, source_path, contract_name)
);

create or replace trigger chainops_pipeline_runs_updated_at
  before update on pipeline_runs for each row execute function chainops_set_updated_at();
