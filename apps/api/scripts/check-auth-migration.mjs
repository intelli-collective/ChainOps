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
  for (const name of ['001_core_schema.sql','002_authentication.sql']) await client.query(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  await client.query("insert into users(full_name,email) values('OAuth user','oauth@example.test')");
  console.log('Auth migrations and passwordless user insertion passed in isolated schema');
} finally { await client.query('rollback'); await client.end(); }
