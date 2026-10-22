// Loads seeds/*.sql (fake development data) in one transaction.
// Run `npm run db:migrate` first.
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set. Run `neon env pull`.');

const dir = new URL('../seeds/', import.meta.url);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin');
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(await readFile(new URL(name, dir), 'utf8'));
    console.log(`seeded ${name}`);
  }
  await client.query('commit');
  const { rows } = await client.query(`
    select (select count(*) from users)::int as users,
           (select count(*) from organizations)::int as organizations,
           (select count(*) from organization_members)::int as members,
           (select count(*) from projects)::int as projects`);
  console.log(rows[0]);
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
