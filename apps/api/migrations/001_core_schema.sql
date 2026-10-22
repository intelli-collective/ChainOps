-- Core tenancy schema: users, organizations, organization members, projects.
-- Matches the tables first created by hand on the Neon `production` branch,
-- so applying it there is a no-op and fresh branches get the same schema.

create or replace function chainops_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists users (
  id uuid not null default gen_random_uuid(),
  full_name varchar(120) not null,
  email varchar(254) not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_email_check check (email = lower(email) and length(trim(email)) > 3),
  constraint users_full_name_check check (length(trim(full_name)) > 0)
);

create table if not exists organizations (
  id uuid not null default gen_random_uuid(),
  name varchar(120) not null,
  slug varchar(80) not null,
  created_by_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug),
  constraint organizations_name_check check (length(trim(name)) > 0),
  constraint organizations_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint organizations_created_by_id_fkey foreign key (created_by_id)
    references users (id) on delete restrict
);

create table if not exists organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  constraint organization_members_pkey primary key (organization_id, user_id),
  constraint organization_members_organization_id_fkey foreign key (organization_id)
    references organizations (id) on delete cascade,
  constraint organization_members_user_id_fkey foreign key (user_id)
    references users (id) on delete cascade
);
create index if not exists idx_organization_members_user_id
  on organization_members (user_id);

create table if not exists projects (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  name varchar(120) not null,
  slug varchar(80) not null,
  description text,
  framework varchar(24) not null default 'hardhat',
  created_by_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_pkey primary key (id),
  constraint projects_organization_id_slug_key unique (organization_id, slug),
  constraint projects_framework_check check (framework in ('hardhat', 'foundry', 'other')),
  constraint projects_name_check check (length(trim(name)) > 0),
  constraint projects_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint projects_organization_id_fkey foreign key (organization_id)
    references organizations (id) on delete cascade,
  constraint projects_created_by_id_fkey foreign key (created_by_id)
    references users (id) on delete restrict
);
create index if not exists idx_projects_organization_id on projects (organization_id);

create or replace trigger chainops_users_updated_at
  before update on users for each row execute function chainops_set_updated_at();
create or replace trigger chainops_organizations_updated_at
  before update on organizations for each row execute function chainops_set_updated_at();
create or replace trigger chainops_projects_updated_at
  before update on projects for each row execute function chainops_set_updated_at();
