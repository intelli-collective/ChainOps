-- M5: platform, access and notifications. Additive only.

-- Organization roles (Figma People / Roles: Owner, Developer, Reviewer, Viewer).
alter table organization_members add column if not exists role varchar(16) not null default 'developer';
do $$ begin
  alter table organization_members add constraint organization_members_role_check
    check (role in ('owner', 'developer', 'reviewer', 'viewer'));
exception when duplicate_object then null; end $$;
-- Existing creators become owners of their organization.
update organization_members m set role = 'owner'
  from organizations o where o.id = m.organization_id and o.created_by_id = m.user_id and m.role <> 'owner';

alter table organizations add column if not exists team_size varchar(16);
do $$ begin
  alter table organizations add constraint organizations_team_size_check
    check (team_size is null or team_size in ('1', '2-10', '11-50', '51+'));
exception when duplicate_object then null; end $$;

-- Project details and setup state (setup_completed_at is null while the creation wizard is in progress).
alter table projects add column if not exists description varchar(500);
alter table projects add column if not exists status varchar(16) not null default 'active';
alter table projects add column if not exists default_branch varchar(255) not null default 'main';
alter table projects add column if not exists setup_completed_at timestamptz;
update projects set setup_completed_at = coalesce(setup_completed_at, created_at);
do $$ begin
  alter table projects add constraint projects_status_check check (status in ('active', 'paused', 'archived'));
exception when duplicate_object then null; end $$;

-- Project-scoped roles. Organization owners can manage every project.
create table if not exists project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role varchar(16) not null check (role in ('owner', 'developer', 'reviewer', 'viewer')),
  added_at timestamptz not null default now(),
  constraint project_members_pkey primary key (project_id, user_id)
);
create index if not exists idx_project_members_user_id on project_members (user_id);
insert into project_members (project_id, user_id, role)
  select p.id, p.created_by_id, 'owner' from projects p on conflict do nothing;

-- Invitations: to an organization, optionally to one project with a project role.
-- Only a hash of the invitation token is stored.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  email varchar(254) not null check (email = lower(email)),
  role varchar(16) not null check (role in ('owner', 'developer', 'reviewer', 'viewer')),
  status varchar(16) not null default 'pending' check (status in ('draft', 'pending', 'accepted', 'revoked', 'expired')),
  token_hash char(64) unique,
  invited_by uuid references users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_open_org_email_key
  on invitations (organization_id, email) where project_id is null and status in ('draft', 'pending');
create unique index if not exists invitations_open_project_email_key
  on invitations (project_id, email) where project_id is not null and status in ('draft', 'pending');
create index if not exists idx_invitations_email on invitations (email);

-- Organization integrations (GitHub). No tokens are stored here.
create table if not exists organization_integrations (
  organization_id uuid not null references organizations (id) on delete cascade,
  provider varchar(16) not null check (provider in ('github')),
  account_login varchar(100) not null,
  account_type varchar(16) not null check (account_type in ('User', 'Organization')),
  access_mode varchar(16) not null default 'public' check (access_mode in ('public')),
  connected_by uuid references users (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  constraint organization_integrations_pkey primary key (organization_id, provider)
);

-- Deployment/development networks per project. The RPC URL may embed an API key,
-- so it is stored encrypted and only a masked form is ever returned.
create table if not exists environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name varchar(80) not null check (length(trim(name)) > 0),
  description varchar(300),
  network varchar(32) not null check (network in ('hardhat-local', 'sepolia', 'holesky', 'ethereum-mainnet', 'custom')),
  chain_id bigint not null check (chain_id > 0),
  rpc_url_encrypted text not null,
  rpc_url_masked varchar(300) not null,
  last_check_at timestamptz,
  last_check_ok boolean,
  last_check_message varchar(300),
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint environments_project_name_key unique (project_id, name)
);

-- Project / environment variables. Values are encrypted at rest (AES-256-GCM) and
-- secret values are never returned after they are stored.
create table if not exists environment_variables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  environment_id uuid references environments (id) on delete cascade,
  key varchar(128) not null check (key ~ '^[A-Z_][A-Z0-9_]*$'),
  value_encrypted text not null,
  is_secret boolean not null default true,
  created_by uuid references users (id) on delete set null,
  updated_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists environment_variables_scope_key
  on environment_variables (project_id, coalesce(environment_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- User notifications produced from domain events (pipeline results, invitations, ...).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  organization_id uuid references organizations (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  type varchar(32) not null check (type in ('pipeline_failed', 'pipeline_passed', 'invitation', 'member_joined', 'approval', 'deployment', 'alert', 'policy', 'platform')),
  title varchar(160) not null,
  body varchar(500) not null,
  link varchar(300),
  link_label varchar(60),
  context varchar(160),
  -- Event identity: the same event never notifies the same user twice.
  dedupe_key varchar(200) not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_dedupe_key unique (user_id, dedupe_key)
);
create index if not exists idx_notifications_user_created on notifications (user_id, created_at desc);

create or replace trigger chainops_environments_updated_at
  before update on environments for each row execute function chainops_set_updated_at();
create or replace trigger chainops_environment_variables_updated_at
  before update on environment_variables for each row execute function chainops_set_updated_at();
