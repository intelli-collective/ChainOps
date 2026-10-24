-- Configuration only: this migration starts no workers and fabricates no events.
create table if not exists monitored_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  name varchar(120) not null check (length(trim(name)) > 0),
  network varchar(32) not null check (network in ('sepolia')),
  address varchar(42) not null check (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monitored_contracts_project_network_address_key unique(project_id,network,address),
  constraint monitored_contracts_project_id_id_key unique(project_id,id)
);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  monitored_contract_id uuid,
  name varchar(120) not null check (length(trim(name)) > 0),
  event_name varchar(128) not null check (event_name ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  condition jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite FK enforces same-project ownership even for direct SQL writes.
  constraint alert_rules_project_monitor_fkey foreign key(project_id,monitored_contract_id)
    references monitored_contracts(project_id,id) on delete restrict,
  constraint alert_rules_condition_check check (
    jsonb_typeof(condition) = 'object'
    and condition ?& array['field','operator','value']
    and condition - array['field','operator','value'] = '{}'::jsonb
    and jsonb_typeof(condition->'field') = 'string'
    and (condition->>'field') ~ '^[A-Za-z_][A-Za-z0-9_]{0,127}$'
    and jsonb_typeof(condition->'operator') = 'string'
    and condition->>'operator' in ('eq','gt','gte','lt','lte')
    and jsonb_typeof(condition->'value') = 'string'
    and (condition->>'value') ~ '^(0|[1-9][0-9]{0,77})$'
    and case when (condition->>'value') ~ '^(0|[1-9][0-9]{0,77})$'
      then (condition->>'value')::numeric <= 115792089237316195423570985008687907853269984665640564039457584007913129639935
      else false end
  )
);
create index if not exists idx_alert_rules_project_id on alert_rules(project_id,created_at,id);
create index if not exists idx_alert_rules_project_monitor on alert_rules(project_id,monitored_contract_id);
create index if not exists idx_monitored_contracts_project_created on monitored_contracts(project_id,created_at,id);

create or replace trigger chainops_monitored_contracts_updated_at
  before update on monitored_contracts for each row execute function chainops_set_updated_at();
create or replace trigger chainops_alert_rules_updated_at
  before update on alert_rules for each row execute function chainops_set_updated_at();
