-- Additive, single-use password recovery tokens. Raw tokens are sent only by email.
create table password_resets (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on password_resets(user_id);
create index on password_resets(expires_at);
