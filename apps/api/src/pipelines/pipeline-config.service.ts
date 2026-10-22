import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { PipelineConfigInput, PipelineConfigPatch, PipelineFramework, PipelineStage } from './pipeline-config.validation.js';

interface PipelineConfigRow {
  id: string;
  project_id: string;
  name: string;
  repository: string;
  branch: string;
  framework: PipelineFramework;
  stages: PipelineStage[];
  created_at: Date;
  updated_at: Date;
}

export interface PipelineConfig {
  id: string;
  projectId: string;
  name: string;
  repository: string;
  branch: string;
  framework: PipelineFramework;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

// Request field -> column. PATCH SQL is built only from these fixed names.
const COLUMNS = { name: 'name', repository: 'repository', branch: 'branch', framework: 'framework', stages: 'stages' } as const;

const present = (row: PipelineConfigRow): PipelineConfig => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  repository: row.repository,
  branch: row.branch,
  framework: row.framework,
  stages: row.stages,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

@Injectable()
export class PipelineConfigService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  // 404 when the project does not exist, 403 when the user is not a member of its organization.
  private async authorize(projectId: string, userId: string): Promise<{ framework: PipelineFramework }> {
    const { rows } = await this.db.query<{ framework: PipelineFramework; is_member: boolean }>(
      `select p.framework,
              exists(select 1 from organization_members m where m.organization_id = p.organization_id and m.user_id = $2) as is_member
         from projects p where p.id = $1`,
      [projectId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Project not found');
    if (!rows[0].is_member) throw new ForbiddenException('You are not a member of this project\'s organization');
    return rows[0];
  }

  async create(projectId: string, userId: string, input: PipelineConfigInput): Promise<PipelineConfig> {
    const project = await this.authorize(projectId, userId);
    const { rows } = await this.db.query<PipelineConfigRow>(
      `insert into pipeline_configs (project_id, name, repository, branch, framework, stages)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (project_id) do nothing
       returning *`,
      [projectId, input.name, input.repository, input.branch, input.framework ?? project.framework, JSON.stringify(input.stages)],
    );
    if (!rows[0]) throw new ConflictException('This project already has a pipeline configuration; use PATCH to change it');
    return present(rows[0]);
  }

  async get(projectId: string, userId: string): Promise<PipelineConfig> {
    await this.authorize(projectId, userId);
    const { rows } = await this.db.query<PipelineConfigRow>('select * from pipeline_configs where project_id = $1', [projectId]);
    if (!rows[0]) throw new NotFoundException('Pipeline configuration not found for this project');
    return present(rows[0]);
  }

  async update(projectId: string, userId: string, patch: PipelineConfigPatch): Promise<PipelineConfig> {
    await this.authorize(projectId, userId);
    const sets: string[] = [];
    const values: unknown[] = [projectId];
    for (const [field, column] of Object.entries(COLUMNS) as [keyof PipelineConfigPatch, string][]) {
      const value = patch[field];
      if (value === undefined) continue;
      values.push(field === 'stages' ? JSON.stringify(value) : value);
      sets.push(`${column} = $${values.length}${field === 'stages' ? '::jsonb' : ''}`);
    }
    // updated_at is maintained by the chainops_pipeline_configs_updated_at trigger.
    const { rows } = await this.db.query<PipelineConfigRow>(
      `update pipeline_configs set ${sets.join(', ')} where project_id = $1 returning *`,
      values,
    );
    if (!rows[0]) throw new NotFoundException('Pipeline configuration not found for this project');
    return present(rows[0]);
  }
}
