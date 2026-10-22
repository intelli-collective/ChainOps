-- Fake development data. Safe to re-run: existing rows are left as they are.
-- password_hash is a placeholder until authentication is implemented; no one can sign in with it.

insert into users (full_name, email, password_hash) values
  ('Amaya Perera', 'amaya.perera@chainops.dev', 'seed-placeholder-not-a-real-hash'),
  ('Nimal Silva', 'nimal.silva@chainops.dev', 'seed-placeholder-not-a-real-hash'),
  ('Kavindi Fernando', 'kavindi.fernando@chainops.dev', 'seed-placeholder-not-a-real-hash'),
  ('Ravi Jayasinghe', 'ravi.jayasinghe@chainops.dev', 'seed-placeholder-not-a-real-hash')
on conflict (email) do nothing;

insert into organizations (name, slug, created_by_id)
select v.name, v.slug, u.id
from (values
  ('ChainOps Team', 'chainops-team', 'amaya.perera@chainops.dev'),
  ('Lanka DeFi Labs', 'lanka-defi-labs', 'ravi.jayasinghe@chainops.dev')
) as v (name, slug, owner_email)
join users u on u.email = v.owner_email
on conflict (slug) do nothing;

insert into organization_members (organization_id, user_id)
select o.id, u.id
from (values
  ('chainops-team', 'amaya.perera@chainops.dev'),
  ('chainops-team', 'nimal.silva@chainops.dev'),
  ('chainops-team', 'kavindi.fernando@chainops.dev'),
  ('lanka-defi-labs', 'ravi.jayasinghe@chainops.dev'),
  ('lanka-defi-labs', 'kavindi.fernando@chainops.dev')
) as v (org_slug, email)
join organizations o on o.slug = v.org_slug
join users u on u.email = v.email
on conflict (organization_id, user_id) do nothing;

insert into projects (organization_id, name, slug, description, framework, created_by_id)
select o.id, v.name, v.slug, v.description, v.framework, u.id
from (values
  ('chainops-team', 'ChainVault', 'chainvault', 'Multi-signature vault and treasury contracts.', 'hardhat', 'amaya.perera@chainops.dev'),
  ('chainops-team', 'Token Factory', 'token-factory', 'ERC-20 token deployment toolkit.', 'foundry', 'nimal.silva@chainops.dev'),
  ('lanka-defi-labs', 'NFT Marketplace', 'nft-marketplace', 'ERC-721 marketplace with royalty support.', 'hardhat', 'ravi.jayasinghe@chainops.dev'),
  ('lanka-defi-labs', 'DAO Governance', 'dao-governance', 'On-chain proposals and voting.', 'foundry', 'kavindi.fernando@chainops.dev')
) as v (org_slug, name, slug, description, framework, creator_email)
join organizations o on o.slug = v.org_slug
join users u on u.email = v.creator_email
on conflict (organization_id, slug) do nothing;
