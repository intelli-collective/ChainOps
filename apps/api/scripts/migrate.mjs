// Applies migrations/*.sql in order, once each. Uses the direct (unpooled)
// connection, as Neon recommends for schema changes.
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set. Run `neon env pull`.');

const dir = new URL('../migrations/', import.meta.url);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const { rows } = await client.query('select name from schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue;
    await client.query('begin');
    await client.query(await readFile(new URL(name, dir), 'utf8'));
    await client.query('insert into schema_migrations (name) values ($1)', [name]);
    await client.query('commit');
    console.log(`applied ${name}`);
  }
  console.log('migrations up to date');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
