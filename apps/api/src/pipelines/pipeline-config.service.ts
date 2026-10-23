import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { GitHubService } from './github.service.js';
import { requireProjectMember } from './pipeline-access.js';
import { defaultCommands } from './pipeline-config.validation.js';
import type { PipelineConfigInput, PipelineConfigPatch, PipelineFramework, PipelineStage, PipelineTrigger } from './pipeline-config.validation.js';

export interface PipelineConfigRow {
  id: string;
  project_id: string;
  name: string;
  repository: string;
  branch: string;
  framework: PipelineFramework;
  stages: PipelineStage[];
  build_command: string | null;
  test_command: string | null;
  triggers: PipelineTrigger[];
  slither_config: string | null;
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
  buildCommand: string | null;
  testCommand: string | null;
  // Commands that will actually run (configured value or framework default).
  effectiveBuildCommand: string;
  effectiveTestCommand: string;
  triggers: PipelineTrigger[];
  slitherConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

// Request field -> column. PATCH SQL is built only from these fixed names.
const COLUMNS = {
  name: 'name', repository: 'repository', branch: 'branch', framework: 'framework', stages: 'stages',
  buildCommand: 'build_command', testCommand: 'test_command', triggers: 'triggers', slitherConfig: 'slither_config',
} as const;
const JSON_FIELDS = new Set(['stages', 'triggers']);

export const presentConfig = (row: PipelineConfigRow): PipelineConfig => {
  const defaults = defaultCommands(row.framework);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    repository: row.repository,
    branch: row.branch,
    framework: row.framework,
    stages: row.stages,
    buildCommand: row.build_command,
    testCommand: row.test_command,
    effectiveBuildCommand: row.build_command ?? defaults.build,
    effectiveTestCommand: row.test_command ?? defaults.test,
    triggers: row.triggers,
    slitherConfig: row.slither_config,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

@Injectable()
export class PipelineConfigService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GitHubService) private readonly github: GitHubService,
  ) {}

  async create(projectId: string, userId: string, input: PipelineConfigInput): Promise<PipelineConfig> {
    const project = await requireProjectMember(this.db, projectId, userId);
    // The repository must exist and the branch must be real before it is saved.
    await this.github.resolveBranch(input.repository, input.branch);
    const { rows } = await this.db.query<PipelineConfigRow>(
      `insert into pipeline_configs (project_id, name, repository, branch, framework, stages, build_command, test_command, triggers, slither_config)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
       on conflict (project_id) do nothing
       returning *`,
      [projectId, input.name, input.repository, input.branch, input.framework ?? project.framework, JSON.stringify(input.stages),
        input.buildCommand ?? null, input.testCommand ?? null, JSON.stringify(input.triggers ?? ['push', 'pull_request']), input.slitherConfig ?? null],
    );
    if (!rows[0]) throw new ConflictException('This project already has a pipeline configuration; use PATCH to change it');
    return presentConfig(rows[0]);
  }

  async get(projectId: string, userId: string): Promise<PipelineConfig> {
    await requireProjectMember(this.db, projectId, userId);
    return presentConfig(await this.row(projectId));
  }

  // Internal read for other M1 services; callers must already have authorized the user.
  async row(projectId: string): Promise<PipelineConfigRow> {
    const { rows } = await this.db.query<PipelineConfigRow>('select * from pipeline_configs where project_id = $1', [projectId]);
    if (!rows[0]) throw new NotFoundException('Pipeline configuration not found for this project');
    return rows[0];
  }

  async update(projectId: string, userId: string, patch: PipelineConfigPatch): Promise<PipelineConfig> {
    await requireProjectMember(this.db, projectId, userId);
    if (patch.repository !== undefined || patch.branch !== undefined) {
      const current = await this.row(projectId);
      await this.github.resolveBranch(patch.repository ?? current.repository, patch.branch ?? current.branch);
    }
    const sets: string[] = [];
    const values: unknown[] = [projectId];
    for (const [field, column] of Object.entries(COLUMNS) as [keyof PipelineConfigPatch, string][]) {
      const value = patch[field];
      if (value === undefined) continue;
      const json = JSON_FIELDS.has(field);
      values.push(json ? JSON.stringify(value) : value);
      sets.push(`${column} = $${values.length}${json ? '::jsonb' : ''}`);
    }
    // updated_at is maintained by the chainops_pipeline_configs_updated_at trigger.
    const { rows } = await this.db.query<PipelineConfigRow>(
      `update pipeline_configs set ${sets.join(', ')} where project_id = $1 returning *`,
      values,
    );
    if (!rows[0]) throw new NotFoundException('Pipeline configuration not found for this project');
    return presentConfig(rows[0]);
  }
}
