import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface SearchResult {
  type: 'project' | 'run' | 'contract';
  title: string;
  context: string;
  link: string;
}

const like = (value: string) => `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/**
 * Global search across resources the user can access: projects, pipeline runs and
 * contract artifacts in the user's organizations only.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async search(userId: string, raw: unknown): Promise<{ query: string; results: SearchResult[] }> {
    const query = typeof raw === 'string' ? raw.trim() : '';
    if (query.length < 2 || query.length > 100) throw new BadRequestException('Search for 2–100 characters.');
    const scope = 'p.organization_id in (select organization_id from organization_members where user_id = $1)';
    const projects = await this.db.query<{ slug: string; name: string; org: string }>(
      `select p.slug, p.name, o.name as org from projects p join organizations o on o.id = p.organization_id
        where ${scope} and (p.name ilike $2 or p.slug ilike $2 or p.description ilike $2) order by p.name limit 5`, [userId, like(query)]);
    const runNumber = /^#?(\d{1,9})$/.exec(query)?.[1];
    const sha = /^[0-9a-f]{4,40}$/i.test(query) ? query.toLowerCase() : null;
    const runs = runNumber || sha ? await this.db.query<{ id: string; run_number: number; commit_sha: string; status: string; slug: string; name: string }>(
      `select r.id, r.run_number, r.commit_sha, r.status, p.slug, p.name from pipeline_runs r join projects p on p.id = r.project_id
        where ${scope} and (r.run_number = $2 or r.commit_sha like $3) order by r.queued_at desc limit 5`,
      [userId, runNumber ? Number(runNumber) : -1, sha ? `${sha}%` : '-']) : { rows: [] };
    const contracts = await this.db.query<{ id: string; name: string; version: string; slug: string; project: string }>(
      `select a.id, a.name, a.version, p.slug, p.name as project from contract_artifacts a join projects p on p.id = a.project_id
        where ${scope} and a.name ilike $2 order by a.created_at desc limit 5`, [userId, like(query)]);
    return {
      query,
      results: [
        ...projects.rows.map((p) => ({ type: 'project' as const, title: p.name, context: p.org, link: `/projects/${p.slug}/dashboard` })),
        ...runs.rows.map((r) => ({ type: 'run' as const, title: `Run #${r.run_number} · ${r.commit_sha.slice(0, 7)}`, context: `${r.name} · ${r.status}`, link: `/projects/${r.slug}/pipelines/${r.id}` })),
        ...contracts.rows.map((c) => ({ type: 'contract' as const, title: `${c.name} ${c.version}`, context: c.project, link: `/projects/${c.slug}/contracts` })),
      ],
    };
  }
}
