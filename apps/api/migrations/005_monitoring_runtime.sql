-- M3 runtime extension. Existing interim configuration remains intact.
alter table monitored_contracts add column if not exists registry_contract_id uuid;
alter table monitored_contracts add column if not exists registry_version varchar(80);
alter table monitored_contracts add column if not exists enabled boolean not null default false;
alter table monitored_contracts add column if not exists polling_seconds integer not null default 10 check (polling_seconds between 2 and 300);
alter table monitored_contracts add column if not exists confirmations integer not null default 12 check (confirmations between 1 and 128);
alter table monitored_contracts add column if not exists start_block bigint check (start_block >= 0);
-- Registry IDs reference the M2 integration contract, not a second registry.
create unique index if not exists idx_monitor_registry on monitored_contracts(project_id,registry_contract_id) where registry_contract_id is not null;

create table if not exists monitoring_subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  monitored_contract_id uuid not null,
  signature varchar(1024) not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(project_id,monitored_contract_id) references monitored_contracts(project_id,id) on delete restrict,
  unique(monitored_contract_id,signature)
);

-- Durable scheduled jobs; standalone workers claim leases with SKIP LOCKED.
create table if not exists monitoring_jobs (
  monitored_contract_id uuid primary key references monitored_contracts(id) on delete restrict,
  next_run_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  checked_at timestamptz,
  succeeded_at timestamptz,
  last_error text,
  last_indexed_block bigint,
  last_head_block bigint,
  failures integer not null default 0
);
create index if not exists idx_monitoring_jobs_due on monitoring_jobs(next_run_at,lease_until);

create table if not exists monitoring_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  monitored_contract_id uuid not null,
  network varchar(32) not null check (network='sepolia'),
  transaction_hash varchar(66) not null check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  block_hash varchar(66) not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  block_number bigint not null check (block_number>=0),
  log_index integer not null check (log_index>=0),
  transaction_index integer not null check (transaction_index>=0),
  block_timestamp timestamptz not null,
  event_name varchar(128),
  signature text,
  decoded_args jsonb,
  raw_log jsonb not null,
  abi jsonb not null,
  registry_version varchar(80),
  release_context jsonb,
  decode_error text,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(project_id,monitored_contract_id) references monitored_contracts(project_id,id) on delete restrict,
  unique(project_id,network,transaction_hash,log_index,block_hash),
  unique(project_id,id)
);
create index if not exists idx_monitoring_events_project_order on monitoring_events(project_id,block_timestamp desc,block_number desc,log_index desc,id desc);
create index if not exists idx_monitoring_events_watcher_block on monitoring_events(monitored_contract_id,block_number);

alter table alert_rules add column if not exists description varchar(1000) not null default '';
alter table alert_rules add column if not exists severity varchar(16) not null default 'warning' check (severity in ('info','warning','critical'));
alter table alert_rules add column if not exists mode varchar(16) not null default 'parameter' check (mode in ('parameter','count'));
alter table alert_rules add column if not exists window_seconds integer check (window_seconds between 60 and 86400);
create unique index if not exists idx_alert_rules_project_id_id on alert_rules(project_id,id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='alert_rules_runtime_mode_check' and conrelid='alert_rules'::regclass) then
    alter table alert_rules add constraint alert_rules_runtime_mode_check check (
      (mode='parameter' and window_seconds is null) or
      (mode='count' and window_seconds is not null and condition->>'field'='count')
    );
  end if;
end $$;

create table if not exists monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  rule_id uuid not null,
  event_id uuid not null,
  title varchar(120) not null,
  severity varchar(16) not null check (severity in ('info','warning','critical')),
  status varchar(16) not null default 'open' check (status in ('open','acknowledged','resolved')),
  evidence jsonb not null,
  acknowledged_by_id uuid references users(id) on delete restrict,
  acknowledged_at timestamptz,
  resolved_by_id uuid references users(id) on delete restrict,
  resolved_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,rule_id) references alert_rules(project_id,id) on delete restrict,
  foreign key(project_id,event_id) references monitoring_events(project_id,id) on delete restrict,
  unique(rule_id,event_id),
  unique(project_id,id)
);
create index if not exists idx_monitoring_alerts_project_created on monitoring_alerts(project_id,created_at desc,id desc);
create table if not exists monitoring_alert_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  alert_id uuid not null,
  action varchar(16) not null check (action in ('triggered','acknowledged','resolved','invalidated')),
  actor_id uuid references users(id) on delete restrict,
  note varchar(2000) not null default '',
  created_at timestamptz not null default now(),
  foreign key(project_id,alert_id) references monitoring_alerts(project_id,id) on delete restrict
);
-- M5 notification delivery is deliberately separate; consumer acknowledges delivery.
create table if not exists monitoring_alert_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  alert_id uuid not null,
  action varchar(16) not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  foreign key(project_id,alert_id) references monitoring_alerts(project_id,id) on delete restrict,
  unique(alert_id,action)
);
create index if not exists idx_monitoring_alert_outbox_pending on monitoring_alert_outbox(created_at) where delivered_at is null;
create or replace trigger chainops_monitoring_alerts_updated_at
  before update on monitoring_alerts for each row execute function chainops_set_updated_at();
