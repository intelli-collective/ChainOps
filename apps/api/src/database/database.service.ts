import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { requireEnv } from '../env.js';

// The API is a long-running Node server, so it reuses one node-postgres pool
// over Neon's pooled connection string (DATABASE_URL).
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: pg.Pool;

  query<R extends pg.QueryResultRow>(text: string, values?: unknown[]) {
    this.pool ??= new pg.Pool({
      connectionString: requireEnv('DATABASE_URL'),
      max: 10,
    });
    return this.pool.query<R>(text, values);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    // Initialize the same pool used by query(), never a second connection pool.
    await this.query('select 1');
    const client = await this.pool!.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }
}
