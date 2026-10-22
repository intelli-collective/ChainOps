import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  // Confirms the API can reach Lakebase Postgres on Neon.
  @Get()
  async health() {
    const { rows } = await this.db.query<{ now: Date }>('select now()');
    return { postgres: 'ok', time: rows[0].now };
  }
}
