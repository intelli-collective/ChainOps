import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../platform/notifications.service.js';
import { collectArtifacts, downloadSource, IMAGES, InfrastructureError, installCommand, runContainer } from './pipeline-executor.js';
import type { RunSnapshot, StageKey, StageStatus } from './pipeline-runs.service.js';

const MAX_LOG_CHARS = 512 * 1024;
const POLL_MS = 2000;
// A claimed job whose heartbeat is older than this belongs to a worker that stopped.
const STALE_SECONDS = 120;

interface ClaimedRun {
  id: string;
  repository: string;
  commit_sha: string;
  config_snapshot: RunSnapshot;
}

class StageFailure extends Error {
  constructor(readonly stage: StageKey, message: string) { super(message); }
}

/**
 * Pipeline worker: claims queued jobs from pipeline_jobs and executes each run in
 * an isolated temporary workspace. Runs in the API process by default; set
 * PIPELINE_WORKER=off to run the API without executing pipelines.
 */
@Injectable()
export class PipelineWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('PipelineWorker');
  private readonly workerId = `${hostname()}:${process.pid}`;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private busy = false;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    // Optional so the worker still runs where the platform module is not wired (tests).
    @Optional() @Inject(NotificationsService) private readonly notifications?: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.PIPELINE_WORKER === 'off' || process.env.VITEST) return;
    this.logger.log(`Pipeline worker ${this.workerId} started`);
    this.schedule(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private schedule(delay: number) {
    if (!this.stopped) this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.recoverStale();
      const run = await this.claim();
      if (run) await this.execute(run);
    } catch (error) {
      this.logger.error(`Worker loop error: ${(error as Error).message}`);
    } finally {
      this.busy = false;
      this.schedule(POLL_MS);
    }
  }

  // One job at a time per worker; SKIP LOCKED lets several workers share the queue safely.
  private async claim(): Promise<ClaimedRun | null> {
    return this.db.transaction(async (client) => {
      const job = await client.query<{ run_id: string }>(
        `update pipeline_jobs set status = 'claimed', attempts = attempts + 1, locked_by = $1, heartbeat_at = now()
          where id = (select j.id from pipeline_jobs j join pipeline_runs r on r.id = j.run_id
                       where j.status = 'queued' and r.status = 'queued'
                       order by j.created_at for update of j skip locked limit 1)
          returning run_id`, [this.workerId]);
      if (!job.rows[0]) return null;
      const { rows } = await client.query<ClaimedRun>(
        `update pipeline_runs set status = 'running', started_at = now() where id = $1 and status = 'queued'
          returning id, repository, commit_sha, config_snapshot`, [job.rows[0].run_id]);
      return rows[0] ?? null;
    });
  }

  private async recoverStale() {
    await this.db.transaction(async (client) => {
      const { rows } = await client.query<{ run_id: string }>(
        `update pipeline_jobs set status = 'done' where status = 'claimed' and heartbeat_at < now() - make_interval(secs => $1) returning run_id`, [STALE_SECONDS]);
      for (const { run_id } of rows) {
        await client.query(`update pipeline_runs set status = 'error', failure_reason = 'The pipeline worker stopped while executing this run.', finished_at = now() where id = $1 and status = 'running'`, [run_id]);
        await client.query(`update pipeline_run_stages set status = 'cancelled', finished_at = now() where run_id = $1 and status = 'running'`, [run_id]);
        await client.query(`update pipeline_run_stages set status = 'skipped', skip_reason = 'Not started: the run stopped earlier.' where run_id = $1 and status = 'pending'`, [run_id]);
      }
    });
  }

  private async setStage(runId: string, key: StageKey, status: StageStatus) {
    const timing = status === 'running' ? ', started_at = now()' : status === 'pending' ? '' : ', finished_at = now()';
    await this.db.query(`update pipeline_run_stages set status = $3${timing} where run_id = $1 and key = $2`, [runId, key, status]);
  }

  private async stageStatus(runId: string, key: StageKey): Promise<StageStatus> {
    const { rows } = await this.db.query<{ status: StageStatus }>('select status from pipeline_run_stages where run_id = $1 and key = $2', [runId, key]);
    return rows[0]?.status ?? 'skipped';
  }

  /** Appends stage output in batches so the UI can show live logs. */
  private logWriter(runId: string, key: StageKey) {
    let pending = '';
    let written = 0;
    let truncated = false;
    let flushing = Promise.resolve();
    const flush = () => {
      if (!pending) return flushing;
      const text = pending;
      pending = '';
      flushing = flushing.then(() => this.db.query('update pipeline_run_stages set log = log || $3 where run_id = $1 and key = $2', [runId, key, text])
        .then(() => this.db.query('update pipeline_jobs set heartbeat_at = now() where run_id = $1', [runId])).then(() => undefined));
      return flushing;
    };
    const interval = setInterval(() => void flush(), 1000);
    return {
      write: (text: string) => {
        if (truncated) return;
        const clean = text.replace(/\r\n?/g, '\n');
        if (written + clean.length > MAX_LOG_CHARS) {
          pending += clean.slice(0, MAX_LOG_CHARS - written) + '\n[WARN] Log truncated at 512 KB.\n';
          truncated = true;
        } else {
          pending += clean;
        }
        written += clean.length;
      },
      close: async () => { clearInterval(interval); await flush(); },
    };
  }

  private cancelRequested = async (runId: string) => {
    const { rows } = await this.db.query<{ cancel: boolean }>('select cancel_requested_at is not null as cancel from pipeline_runs where id = $1', [runId]);
    return rows[0]?.cancel ?? false;
  };

  private async containerStage(run: ClaimedRun, key: StageKey, workspace: string, commands: string[]) {
    const log = this.logWriter(run.id, key);
    await this.setStage(run.id, key, 'running');
    const image = IMAGES[run.config_snapshot.framework];
    // `set -e` stops at the first failing command; each command is echoed first.
    const script = ['set -e', ...commands.flatMap((cmd) => [`echo '$ ${cmd.replace(/'/g, "'\\''")}'`, cmd])].join('\n');
    log.write(`[INFO] Image ${image}\n[INFO] Commit ${run.commit_sha}\n`);
    try {
      const result = await runContainer({
        name: `chainops-run-${run.id}-${key}`,
        image, workspace, script,
        timeoutMs: Number(process.env.PIPELINE_STAGE_TIMEOUT_SECONDS ?? 900) * 1000,
        onOutput: log.write,
        shouldCancel: () => this.cancelRequested(run.id),
      });
      if (result.killedFor === 'cancel') { log.write('\n[WARN] Run cancelled by user.\n'); throw new StageFailure(key, 'cancelled'); }
      if (result.killedFor === 'timeout') { log.write('\n[ERROR] Stage timed out.\n'); throw new StageFailure(key, `${key} stage timed out.`); }
      // 125: Docker could not start the container (daemon or image problem).
      if (result.exitCode === 125) throw new InfrastructureError('Docker could not start the build container. Check the worker logs.');
      if (result.exitCode !== 0) {
        log.write(`\n[ERROR] Exited with code ${result.exitCode}.\n`);
        throw new StageFailure(key, `${key === 'test' ? 'Tests did not pass' : 'Build failed'} (exit code ${result.exitCode}).`);
      }
      log.write('\n[INFO] Stage completed successfully.\n');
    } finally {
      await log.close();
    }
  }

  private async execute(run: ClaimedRun) {
    this.logger.log(`Executing run ${run.id} (${run.repository}@${run.commit_sha.slice(0, 7)})`);
    const workspace = await mkdtemp(join(process.env.PIPELINE_WORKSPACE_ROOT ?? tmpdir(), 'chainops-run-'));
    // Keeps the claim alive during quiet stages so it is not treated as stale.
    const heartbeat = setInterval(() => {
      this.db.query('update pipeline_jobs set heartbeat_at = now() where run_id = $1', [run.id]).catch(() => undefined);
    }, 30000);
    let current: StageKey = 'checkout';
    try {
      // Checkout: exact commit from GitHub into a fresh temporary workspace.
      const checkout = this.logWriter(run.id, 'checkout');
      await this.setStage(run.id, 'checkout', 'running');
      try {
        checkout.write(`[INFO] Fetching ${run.repository} at ${run.commit_sha}\n`);
        await downloadSource(run.repository, run.commit_sha, workspace);
        checkout.write('[INFO] Source extracted into an isolated temporary workspace.\n');
      } finally {
        await checkout.close();
      }
      await this.setStage(run.id, 'checkout', 'success');

      if (await this.cancelRequested(run.id)) throw new StageFailure('build', 'cancelled');
      current = 'build';
      if (await this.stageStatus(run.id, 'build') === 'pending') {
        const install = await installCommand(run.config_snapshot.framework, workspace);
        await this.containerStage(run, 'build', workspace, [...(install ? [install] : []), run.config_snapshot.buildCommand]);
        const artifacts = await collectArtifacts(run.config_snapshot.framework, workspace);
        for (const artifact of artifacts) {
          await this.db.query(
            `insert into pipeline_artifacts (run_id, contract_name, source_path, artifact_path, abi, bytecode, deployed_bytecode, compiler_version, build_metadata)
             values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb) on conflict do nothing`,
            [run.id, artifact.contractName, artifact.sourcePath, artifact.artifactPath, JSON.stringify(artifact.abi), artifact.bytecode,
              artifact.deployedBytecode, artifact.compilerVersion, JSON.stringify(artifact.metadata)]);
        }
        await this.db.query('update pipeline_run_stages set log = log || $2 where run_id = $1 and key = \'build\'',
          [run.id, `[INFO] ${artifacts.length} contract artifact(s) captured (ABI, bytecode, compiler metadata).\n`]);
        await this.setStage(run.id, 'build', 'success');
      }

      if (await this.cancelRequested(run.id)) throw new StageFailure('test', 'cancelled');
      current = 'test';
      if (await this.stageStatus(run.id, 'test') === 'pending') {
        await this.containerStage(run, 'test', workspace, [run.config_snapshot.testCommand]);
        await this.setStage(run.id, 'test', 'success');
      }
      await this.finish(run.id, 'success', null, null);
    } catch (error) {
      const failure = error instanceof StageFailure ? error : null;
      const stage = failure?.stage ?? current;
      if (failure?.message === 'cancelled') {
        await this.setStage(run.id, stage, 'cancelled');
        await this.finish(run.id, 'cancelled', null, null);
      } else {
        const infrastructure = !failure;
        const message = error instanceof Error ? error.message : String(error);
        await this.db.query('update pipeline_run_stages set log = log || $3 where run_id = $1 and key = $2', [run.id, stage, `\n[ERROR] ${message}\n`]);
        await this.setStage(run.id, stage, 'failed');
        // Infrastructure problems are 'error', not a failed build of the user's code.
        await this.finish(run.id, infrastructure ? 'error' : 'failed', stage, message);
        if (infrastructure && !(error instanceof InfrastructureError)) this.logger.error(`Run ${run.id} errored: ${message}`);
      }
    } finally {
      clearInterval(heartbeat);
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async finish(runId: string, status: 'success' | 'failed' | 'cancelled' | 'error', stage: StageKey | null, reason: string | null) {
    await this.db.transaction(async (client) => {
      await client.query('update pipeline_runs set status = $2, failure_stage = $3, failure_reason = $4, finished_at = now() where id = $1', [runId, status, stage, reason]);
      await client.query(`update pipeline_run_stages set status = 'skipped', skip_reason = coalesce(skip_reason, 'Not started: an earlier stage did not pass.') where run_id = $1 and status = 'pending'`, [runId]);
      await client.query("update pipeline_jobs set status = 'done', heartbeat_at = now() where run_id = $1", [runId]);
    });
    this.logger.log(`Run ${runId} finished: ${status}`);
    await this.notifyFinished(runId, status, stage, reason).catch((error: Error) => this.logger.warn(`Notification failed for run ${runId}: ${error.message}`));
  }

  // Domain event → shared notification for the person who started the run.
  private async notifyFinished(runId: string, status: 'success' | 'failed' | 'cancelled' | 'error', stage: StageKey | null, reason: string | null) {
    if (!this.notifications || status === 'cancelled') return;
    const { rows } = await this.db.query<{ triggered_by: string | null; run_number: number; project_id: string; organization_id: string; project: string; slug: string }>(
      `select r.triggered_by, r.run_number, r.project_id, p.organization_id, p.name as project, p.slug
         from pipeline_runs r join projects p on p.id = r.project_id where r.id = $1`, [runId]);
    const run = rows[0];
    if (!run?.triggered_by) return;
    const failed = status !== 'success';
    await this.notifications.notify([run.triggered_by], {
      type: failed ? 'pipeline_failed' : 'pipeline_passed',
      title: status === 'success' ? 'Build passed' : status === 'error' ? 'Build could not run' : 'Build failed',
      body: status === 'success' ? `Run #${run.run_number} passed build and tests.` : `Run #${run.run_number} ${status === 'error' ? 'errored' : `failed at ${stage ?? 'a stage'}`}${reason ? `: ${reason}` : '.'}`,
      organizationId: run.organization_id, projectId: run.project_id,
      link: `/projects/${run.slug}/pipelines/${runId}${failed ? '?tab=test-logs' : ''}`, linkLabel: failed ? 'View logs' : 'View run',
      context: `${run.project} · Run #${run.run_number}`, dedupeKey: `pipeline-run:${runId}:finished`,
    });
  }
}
