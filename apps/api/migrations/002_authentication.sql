-- Preserve existing users and credentials; OAuth users do not have passwords.
alter table users alter column password_hash drop not null;
alter table users add column email_verified_at timestamptz;
create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('local','google','github')),
  subject text not null check (length(subject) > 0),
  unique(provider, subject), unique(user_id, provider)
);
create table password_credentials (
  user_id uuid primary key references users(id) on delete cascade,
  password_hash text not null
);
insert into password_credentials select id, password_hash from users where password_hash is not null;
insert into auth_identities(user_id,provider,subject) select id,'local',id::text from users where password_hash is not null;
create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on auth_sessions(user_id);
create table refresh_tokens (
  token_hash text primary key,
  session_id uuid not null references auth_sessions(id) on delete cascade,
  consumed_at timestamptz
);
create index on refresh_tokens(session_id);
create table email_verifications (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table oauth_attempts (
  state_hash text primary key,
  provider text not null check(provider in ('google','github')),
  verifier text not null,
  nonce text not null,
  browser_hash text not null,
  expires_at timestamptz not null
);
-- Shared across API replicas. Only hashed IP identifiers are retained.
create table auth_rate_limits (
  key text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
