-- M1: one stored pipeline configuration per project. Additive only.
-- This is configuration metadata; it does not run pipelines or contact GitHub.
create table if not exists pipeline_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  name varchar(120) not null,
  repository varchar(140) not null,
  branch varchar(255) not null,
  framework varchar(24) not null,
  stages jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_configs_project_id_key unique (project_id),
  constraint pipeline_configs_project_id_fkey foreign key (project_id)
    references projects (id) on delete cascade,
  constraint pipeline_configs_name_check check (length(trim(name)) > 0),
  constraint pipeline_configs_repository_check
    check (repository ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'),
  constraint pipeline_configs_branch_check check (length(trim(branch)) > 0),
  constraint pipeline_configs_framework_check check (framework in ('hardhat', 'foundry', 'other')),
  constraint pipeline_configs_stages_check
    check (jsonb_typeof(stages) = 'array' and jsonb_array_length(stages) > 0)
);

create or replace trigger chainops_pipeline_configs_updated_at
  before update on pipeline_configs for each row execute function chainops_set_updated_at();
