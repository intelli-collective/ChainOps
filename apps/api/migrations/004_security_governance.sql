-- M4 interim governance: stored configuration and requests only.
-- These rows do not represent a scan, policy evaluation, or deployment approval.
create table security_policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  name varchar(120) not null check (length(trim(name)) > 0),
  block_critical boolean not null,
  block_high boolean not null,
  require_approval boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_security_policies_project_created
  on security_policies (project_id, created_at desc, id desc);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  title varchar(200) not null check (length(trim(title)) > 0),
  description text,
  requested_by_id uuid not null references users(id) on delete restrict,
  status varchar(24) not null default 'PENDING'
    check (status = 'PENDING'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_approval_requests_project_created
  on approval_requests (project_id, created_at desc, id desc);
create index idx_approval_requests_requested_by
  on approval_requests (requested_by_id);

create trigger chainops_security_policies_updated_at
  before update on security_policies
  for each row execute function chainops_set_updated_at();
create trigger chainops_approval_requests_updated_at
  before update on approval_requests
  for each row execute function chainops_set_updated_at();
