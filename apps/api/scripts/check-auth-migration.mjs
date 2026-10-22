// Validates DDL in an isolated schema and rolls everything back. No production data changes.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
await client.connect();
try {
  await client.query('begin');
  const schema = `auth_check_${randomUUID().replaceAll('-', '')}`;
  await client.query(`create schema "${schema}"`);
  await client.query(`set local search_path to "${schema}"`);
  await client.query(await readFile(new URL('../migrations/001_core_schema.sql',import.meta.url),'utf8'));
  await client.query("insert into users(full_name,email,password_hash) values('Legacy user','legacy@example.test','existing-password-hash')");
  await client.query(await readFile(new URL('../migrations/002_authentication.sql',import.meta.url),'utf8'));
  const { rows } = await client.query("select u.password_hash as legacy_hash,p.password_hash,u.email_verified_at,i.provider from users u join password_credentials p on p.user_id=u.id join auth_identities i on i.user_id=u.id where u.email='legacy@example.test'");
  if (rows.length !== 1 || rows[0].password_hash !== 'existing-password-hash' || rows[0].legacy_hash !== rows[0].password_hash || rows[0].email_verified_at !== null || rows[0].provider !== 'local') throw new Error('Legacy credential preservation failed');
  await client.query("insert into users(full_name,email) values('OAuth user','oauth@example.test')");
  console.log('Auth migrations, legacy credential preservation and passwordless user insertion passed in isolated schema');
} finally { await client.query('rollback'); await client.end(); }
