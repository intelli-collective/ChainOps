-- Proposed slot after 003; confirm ordering with the DB owner before integration.
create table if not exists contract_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  name varchar(120) not null check (length(trim(name)) > 0),
  version varchar(80) not null check (length(trim(version)) > 0),
  framework varchar(24) not null check (framework in ('hardhat', 'foundry', 'other')),
  contract_path varchar(512) not null check (length(trim(contract_path)) > 0),
  compiler_version varchar(80) not null check (length(trim(compiler_version)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_artifacts_project_name_version_key unique (project_id,name,version)
);
create index if not exists idx_contract_artifacts_project_created_id
  on contract_artifacts(project_id,created_at,id);
create or replace trigger chainops_contract_artifacts_updated_at
  before update on contract_artifacts for each row execute function chainops_set_updated_at();
