import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { GitHubService } from './github.service.js';
import { requireProjectMember } from './pipeline-access.js';
import { PipelineConfigService, presentConfig } from './pipeline-config.service.js';
import type { PipelineConfigRow } from './pipeline-config.service.js';
import type { PipelineFramework } from './pipeline-config.validation.js';

export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'error';
export type RunTrigger = 'manual' | 'push' | 'pull_request';
export type StageKey = 'checkout' | 'build' | 'test' | 'slither' | 'policy';
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';

export const STAGE_ORDER: StageKey[] = ['checkout', 'build', 'test', 'slither', 'policy'];
export const STAGE_NAMES: Record<StageKey, string> = { checkout: 'Checkout', build: 'Build', test: 'Test', slither: 'Slither', policy: 'Policy' };
const TERMINAL: RunStatus[] = ['success', 'failed', 'cancelled', 'error'];
// Security analysis and policy decisions are owned by the Security module (M4).
export const M4_SKIP_REASON = 'Security analysis and policy evaluation run in the Security module (M4), which is not connected to pipeline runs yet.';
const DISABLED_REASON = 'Disabled in the pipeline configuration.';

export interface RunSnapshot {
  framework: PipelineFramework;
  buildCommand: string;
  testCommand: string;
  slitherConfig: string | null;
  stages: string[];
}

interface RunRow {
  id: string;
  project_id: string;
  run_number: number;
  status: RunStatus;
  trigger: RunTrigger;
  repository: string;
  branch: string;
  commit_sha: string;
  rerun_of: string | null;
  config_snapshot: RunSnapshot;
  failure_stage: StageKey | null;
  failure_reason: string | null;
  cancel_requested_at: Date | null;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  author: string | null;
}

interface StageRow {
  key: StageKey;
  status: StageStatus;
  log: string;
  skip_reason: string | null;
  started_at: Date | null;
  finished_at: Date | null;
}

interface ArtifactRow {
  id: string;
  run_id: string;
  contract_name: string;
  source_path: string;
  artifact_path: string;
  abi: unknown[];
  bytecode: string;
  deployed_bytecode: string;
  compiler_version: string | null;
  build_metadata: Record<string, unknown>;
  created_at: Date;
}

const seconds = (from: Date | null, to: Date | null) => (from && to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000)) : null);
const iso = (value: Date | null) => (value ? value.toISOString() : null);
const byteLength = (hex: string) => Math.max(0, (hex.replace(/^0x/, '').length) / 2);

function presentRun(row: RunRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    runNumber: row.run_number,
    commitSha: row.commit_sha,
    branch: row.branch,
    repository: row.repository,
    trigger: row.trigger,
    status: row.status,
    author: row.author ?? 'Unknown user',
    queuedAt: row.queued_at.toISOString(),
    startedAt: (row.started_at ?? row.queued_at).toISOString(),
    finishedAt: iso(row.finished_at),
    durationSeconds: seconds(row.started_at, row.finished_at),
    cancelRequested: row.cancel_requested_at !== null,
  };
}

// Stages a run will execute, derived from the configured stage list.
export function plannedStages(snapshot: RunSnapshot): { key: StageKey; status: StageStatus; skipReason: string | null }[] {
  const enabled = new Set(snapshot.stages.map((stage) => (stage === 'compile' ? 'build' : stage === 'security' ? 'slither' : stage)));
  return STAGE_ORDER.map((key) => {
    if (key === 'checkout') return { key, status: 'pending' as const, skipReason: null };
    if (key === 'slither' || key === 'policy') return { key, status: 'skipped' as const, skipReason: enabled.has(key) ? M4_SKIP_REASON : DISABLED_REASON };
    return enabled.has(key) ? { key, status: 'pending' as const, skipReason: null } : { key, status: 'skipped' as const, skipReason: DISABLED_REASON };
  });
}

@Injectable()
export class PipelineRunsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GitHubService) private readonly github: GitHubService,
    @Inject(PipelineConfigService) private readonly configs: PipelineConfigService,
  ) {}

  private runQuery(where: string) {
    return `select r.*, u.full_name as author from pipeline_runs r left join users u on u.id = r.triggered_by where ${where}`;
  }

  async list(projectId: string, userId: string) {
    await requireProjectMember(this.db, projectId, userId);
    const { rows } = await this.db.query<RunRow>(`${this.runQuery('r.project_id = $1')} order by r.run_number desc limit 200`, [projectId]);
    return rows.map(presentRun);
  }

  async branches(projectId: string, userId: string) {
    await requireProjectMember(this.db, projectId, userId);
    const config = await this.configs.row(projectId);
    return { repository: config.repository, defaultBranch: config.branch, branches: await this.github.listBranches(config.repository) };
  }

  async create(projectId: string, userId: string, body: unknown) {
    await requireProjectMember(this.db, projectId, userId);
    const input = (body ?? {}) as Record<string, unknown>;
    if (typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'branch')) throw new BadRequestException('Only "branch" may be provided.');
    const config = await this.configs.row(projectId).catch(() => { throw new ConflictException('Configure the pipeline before starting a run.'); });
    const branch = input.branch === undefined ? config.branch : input.branch;
    if (typeof branch !== 'string' || !/^[A-Za-z0-9._/-]{1,255}$/.test(branch) || branch.includes('..')) throw new BadRequestException('branch must be a valid git branch name.');
    // Pin the run to the exact commit the branch points at now.
    const commitSha = await this.github.resolveBranch(config.repository, branch);
    return this.enqueue(projectId, userId, config, branch, commitSha, null);
  }

  async rerun(projectId: string, userId: string, runId: string) {
    await requireProjectMember(this.db, projectId, userId);
    const original = await this.runRow(projectId, runId);
    if (!TERMINAL.includes(original.status)) throw new ConflictException('Only finished runs can be re-run.');
    const config = await this.configs.row(projectId);
    // Same repository and exact commit as the original run, current configuration.
    return this.enqueue(projectId, userId, { ...config, repository: original.repository }, original.branch, original.commit_sha, original.id);
  }

  private async enqueue(projectId: string, userId: string, config: PipelineConfigRow, branch: string, commitSha: string, rerunOf: string | null) {
    const effective = presentConfig(config);
    const snapshot: RunSnapshot = {
      framework: config.framework,
      buildCommand: effective.effectiveBuildCommand,
      testCommand: effective.effectiveTestCommand,
      slitherConfig: config.slither_config,
      stages: config.stages,
    };
    const runId = await this.db.transaction(async (client: pg.PoolClient) => {
      // Serialize run numbering per project.
      await client.query('select id from projects where id = $1 for update', [projectId]);
      const { rows } = await client.query<{ id: string }>(
        `insert into pipeline_runs (project_id, run_number, trigger, triggered_by, repository, branch, commit_sha, rerun_of, config_snapshot)
         values ($1, (select coalesce(max(run_number), 0) + 1 from pipeline_runs where project_id = $1), 'manual', $2, $3, $4, $5, $6, $7::jsonb)
         returning id`,
        [projectId, userId, config.repository, branch, commitSha, rerunOf, JSON.stringify(snapshot)],
      );
      const id = rows[0].id;
      for (const [position, stage] of plannedStages(snapshot).entries()) {
        await client.query('insert into pipeline_run_stages (run_id, key, position, status, skip_reason) values ($1, $2, $3, $4, $5)', [id, stage.key, position, stage.status, stage.skipReason]);
      }
      // The job only references the persisted run; the worker reads everything else from it.
      await client.query('insert into pipeline_jobs (run_id) values ($1)', [id]);
      return id;
    });
    return presentRun(await this.runRow(projectId, runId));
  }

  private async runRow(projectId: string, runId: string): Promise<RunRow> {
    const { rows } = await this.db.query<RunRow>(this.runQuery('r.project_id = $1 and r.id = $2'), [projectId, runId]);
    if (!rows[0]) throw new NotFoundException('Pipeline run not found in this project');
    return rows[0];
  }

  async get(projectId: string, userId: string, runId: string) {
    await requireProjectMember(this.db, projectId, userId);
    const run = await this.runRow(projectId, runId);
    const stages = await this.db.query<StageRow>('select key, status, log, skip_reason, started_at, finished_at from pipeline_run_stages where run_id = $1 order by position', [runId]);
    const artifacts = await this.db.query<{ contract_name: string }>('select contract_name from pipeline_artifacts where run_id = $1 order by contract_name', [runId]);
    return {
      ...presentRun(run),
      rerunOf: run.rerun_of,
      failureStage: run.failure_stage,
      failureReason: run.failure_reason,
      config: run.config_snapshot,
      artifactCount: artifacts.rowCount ?? 0,
      contracts: artifacts.rows.map((row) => row.contract_name),
      stages: stages.rows.map((stage) => ({
        key: stage.key,
        name: STAGE_NAMES[stage.key],
        status: stage.status,
        startedAt: iso(stage.started_at),
        finishedAt: iso(stage.finished_at),
        durationSeconds: seconds(stage.started_at, stage.finished_at),
        log: stage.log,
        skipReason: stage.skip_reason,
      })),
    };
  }

  async cancel(projectId: string, userId: string, runId: string) {
    await requireProjectMember(this.db, projectId, userId);
    const run = await this.runRow(projectId, runId);
    if (TERMINAL.includes(run.status)) throw new ConflictException(`Run #${run.run_number} has already finished.`);
    await this.db.transaction(async (client: pg.PoolClient) => {
      // A queued run is cancelled immediately; a running one is stopped by the worker.
      const queued = await client.query(
        `update pipeline_runs set status = 'cancelled', cancel_requested_at = now(), finished_at = now()
          where id = $1 and status = 'queued' returning id`, [runId]);
      if (queued.rowCount) {
        await client.query("update pipeline_run_stages set status = 'skipped', skip_reason = coalesce(skip_reason, 'Run cancelled before it started.') where run_id = $1 and status = 'pending'", [runId]);
        await client.query("update pipeline_jobs set status = 'done' where run_id = $1", [runId]);
      } else {
        await client.query('update pipeline_runs set cancel_requested_at = coalesce(cancel_requested_at, now()) where id = $1', [runId]);
      }
    });
    return presentRun(await this.runRow(projectId, runId));
  }

  async artifacts(projectId: string, userId: string, runId: string) {
    await requireProjectMember(this.db, projectId, userId);
    await this.runRow(projectId, runId);
    const { rows } = await this.db.query<ArtifactRow>('select * from pipeline_artifacts where run_id = $1 order by source_path, contract_name', [runId]);
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      contractName: row.contract_name,
      sourcePath: row.source_path,
      artifactPath: row.artifact_path,
      compilerVersion: row.compiler_version,
      abiEntries: row.abi.length,
      bytecodeBytes: byteLength(row.bytecode),
      deployedBytecodeBytes: byteLength(row.deployed_bytecode),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async artifact(projectId: string, userId: string, runId: string, artifactId: string) {
    await requireProjectMember(this.db, projectId, userId);
    await this.runRow(projectId, runId);
    const { rows } = await this.db.query<ArtifactRow>('select * from pipeline_artifacts where run_id = $1 and id = $2', [runId, artifactId]);
    if (!rows[0]) throw new NotFoundException('Artifact not found in this run');
    const row = rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      contractName: row.contract_name,
      sourcePath: row.source_path,
      artifactPath: row.artifact_path,
      compilerVersion: row.compiler_version,
      abi: row.abi,
      bytecode: row.bytecode,
      deployedBytecode: row.deployed_bytecode,
      metadata: row.build_metadata,
      createdAt: row.created_at.toISOString(),
    };
  }
}
