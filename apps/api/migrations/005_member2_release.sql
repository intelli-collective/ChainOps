-- M2 operational records; source artifact definitions remain in contract_artifacts.
-- Publication of immutable artifact/approval evidence and signing are upstream adapters.
create table deployment_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  requested_by_id uuid not null references users(id) on delete restrict,
  idempotency_key varchar(120) not null,
  status varchar(24) not null check (status in ('PREPARING','SUBMITTED','PENDING','CONFIRMED','FAILED','REVERTED','UNKNOWN')),
  -- Public evidence snapshot, written only by the trusted deployment worker.
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  transaction_hash varchar(66) check (transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,requested_by_id,idempotency_key),
  unique(project_id,id),
  check (coalesce(status <> 'CONFIRMED' or (transaction_hash is not null and evidence->'receipt'->>'status' = '0x1'
    and evidence->>'contractAddress' ~ '^0x[0-9a-fA-F]{40}$'
    and (evidence->>'confirmations')::integer >= (evidence->>'requiredConfirmations')::integer
    and (evidence->>'requiredConfirmations')::integer > 0
    and evidence ?& array['receipt','contractAddress','confirmations','requiredConfirmations']), false))
);
create index deployment_records_project_created on deployment_records(project_id,created_at desc,id);
create table registered_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  name varchar(120) not null check (length(trim(name)) > 0),
  version varchar(80) not null check (length(trim(version)) > 0),
  address varchar(42) not null check (address ~ '^0x[0-9a-f]{40}$' and address <> '0x0000000000000000000000000000000000000000'),
  network_id varchar(80) not null,
  chain_id bigint not null check (chain_id > 0),
  network_name varchar(120) not null,
  environment varchar(120) not null,
  provenance varchar(24) not null check (provenance in ('external','deployment')),
  deployment_id uuid,
  created_at timestamptz not null default now(),
  unique(project_id,chain_id,address),
  foreign key(project_id,deployment_id) references deployment_records(project_id,id) on delete restrict,
  check ((provenance = 'external' and deployment_id is null) or (provenance = 'deployment' and deployment_id is not null))
);
create index registered_contracts_project_created on registered_contracts(project_id,created_at desc,id);
create function chainops_registry_confirmed_deployment() returns trigger language plpgsql as $$
begin
  if new.provenance = 'deployment' and not exists (
    select 1 from deployment_records d where d.project_id=new.project_id and d.id=new.deployment_id
      and d.status='CONFIRMED' and lower(d.evidence->>'contractAddress')=new.address
      and (d.evidence->'network'->>'chainId')::bigint=new.chain_id
  ) then
    raise exception 'Registry entry requires a confirmed deployment receipt on the same network and address';
  end if;
  return new;
end;
$$;
create trigger chainops_registry_confirmed before insert or update on registered_contracts
  for each row execute function chainops_registry_confirmed_deployment();
create trigger chainops_deployment_records_updated_at before update on deployment_records
  for each row execute function chainops_set_updated_at();
