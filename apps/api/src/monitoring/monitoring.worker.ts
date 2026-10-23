import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { RegistryGateway } from './registry.gateway.js';
import { ChainGateway, quantity } from './chain.gateway.js';
import { decodeEvent, matches } from './event-decoder.js';
import type { AlertCondition } from './monitoring.validation.js';

interface Watcher {
  id: string;
  project_id: string;
  registry_contract_id: string | null;
  registry_version: string | null;
  address: string;
  network: string;
  polling_seconds: number;
  confirmations: number;
  start_block: string | null;
}
interface Job {
  monitored_contract_id: string;
  lease_token: string;
  last_indexed_block: string | null;
  failures: number;
}
interface Rule {
  id: string;
  name: string;
  condition: AlertCondition;
  mode: string;
  window_seconds: number | null;
  severity: string;
}

/** A separate worker process invokes tick(). HTTP handlers never scan the chain. */
@Injectable()
export class MonitoringWorker {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RegistryGateway) private readonly registry: RegistryGateway,
    @Inject(ChainGateway) private readonly chain: ChainGateway,
  ) {}

  async tick(): Promise<boolean> {
    const token = randomUUID();
    const { rows } = await this.db.query<Job>(
      `with due as (
      select j.monitored_contract_id from monitoring_jobs j join monitored_contracts m on m.id=j.monitored_contract_id
      where m.enabled and j.next_run_at<=now() and (j.lease_until is null or j.lease_until<now())
      order by j.next_run_at for update of j skip locked limit 1
    ) update monitoring_jobs j set lease_token=$1,lease_until=now()+interval '5 minutes' from due
      where j.monitored_contract_id=due.monitored_contract_id returning j.*`,
      [token],
    );
    const job = rows[0];
    if (!job) return false;
    let stage = 'Indexing configuration is unavailable';
    try {
      const monitor = (
        await this.db.query<Watcher>(
          'select * from monitored_contracts where id=$1',
          [job.monitored_contract_id],
        )
      ).rows[0];
      stage = 'Deployed M2 registry address and ABI are unavailable';
      if (!monitor.registry_contract_id) throw new Error();
      const contract = await this.registry.get(
        monitor.project_id,
        monitor.registry_contract_id,
      );
      if (
        contract.address !== monitor.address ||
        contract.network !== monitor.network ||
        contract.version !== monitor.registry_version
      )
        throw new Error();
      const subscriptions = (
        await this.db.query<{ signature: string }>(
          'select signature from monitoring_subscriptions where monitored_contract_id=$1 and enabled',
          [monitor.id],
        )
      ).rows.map((row) => row.signature);
      stage = 'No enabled ABI event subscriptions';
      if (!subscriptions.length) throw new Error();
      stage = 'Sepolia RPC is not configured';
      if (!this.chain.configured()) throw new Error();
      stage = 'Sepolia RPC request failed or returned an incompatible chain';
      const head = await this.chain.head(),
        safeHead = head - monitor.confirmations;
      const start =
        monitor.start_block === null ? safeHead : Number(monitor.start_block);
      const from = Math.max(
        0,
        start,
        job.last_indexed_block === null
          ? start
          : Number(job.last_indexed_block) - 11,
      );
      const to = Math.min(safeHead, from + 99);
      if (to < from) {
        await this.complete(job, monitor, head, null);
        return true;
      }
      const logs = await this.chain.logs(monitor.address, from, to);
      const blockNumbers = [
        ...new Set(logs.map((log) => quantity(log.blockNumber))),
      ];
      const blocks = new Map<number, { hash: string; timestamp: string }>();
      // Bounded concurrency and 100-block ranges keep worker leases finite.
      for (let offset = 0; offset < blockNumbers.length; offset += 10) {
        await Promise.all(
          blockNumbers.slice(offset, offset + 10).map(async (number) => {
            const block = await this.chain.block(number);
            blocks.set(number, {
              hash: block.hash,
              timestamp: new Date(
                quantity(block.timestamp) * 1000,
              ).toISOString(),
            });
          }),
        );
      }
      const decoded = logs
        .filter((log) => !log.removed)
        .map((log) => {
          const block = blocks.get(quantity(log.blockNumber));
          if (!block || block.hash !== log.blockHash.toLowerCase())
            throw new Error('Chain changed while fetching logs');
          return { log, block, ...decodeEvent(log, contract.abi) };
        });
      stage = 'Persisting chain events or evaluating rules failed';
      await this.db.transaction(async (c) => {
        // Fencing: an expired/replaced lease or paused watcher cannot commit.
        const locked = await c.query(
          `select j.monitored_contract_id from monitoring_jobs j join monitored_contracts m on m.id=j.monitored_contract_id
          where j.monitored_contract_id=$1 and j.lease_token=$2 and j.lease_until>now() and m.enabled for update of j,m`,
          [monitor.id, token],
        );
        if (!locked.rows.length) return;
        // Re-fetch the last 12 blocks to reconcile reconnects and shallow reorgs.
        await c.query(
          'update monitoring_events set removed=true where monitored_contract_id=$1 and block_number between $2 and $3',
          [monitor.id, from, to],
        );
        for (const event of decoded) {
          if (event.signature && !subscriptions.includes(event.signature)) {
            // Unsubscribing must not label previously indexed evidence as a reorg.
            await c.query(
              'update monitoring_events set removed=false where monitored_contract_id=$1 and transaction_hash=$2 and log_index=$3 and block_hash=$4',
              [
                monitor.id,
                event.log.transactionHash.toLowerCase(),
                quantity(event.log.logIndex),
                event.log.blockHash.toLowerCase(),
              ],
            );
            continue;
          }
          const { rows: inserted } = await c.query<{
            id: string;
            fresh: boolean;
          }>(
            `insert into monitoring_events(project_id,monitored_contract_id,network,transaction_hash,block_hash,block_number,log_index,transaction_index,block_timestamp,event_name,signature,decoded_args,raw_log,abi,registry_version,decode_error,release_context)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17::jsonb)
            on conflict(project_id,network,transaction_hash,log_index,block_hash) do update set removed=false
            returning id,(xmax=0) as fresh`,
            [
              monitor.project_id,
              monitor.id,
              monitor.network,
              event.log.transactionHash.toLowerCase(),
              event.log.blockHash.toLowerCase(),
              quantity(event.log.blockNumber),
              quantity(event.log.logIndex),
              quantity(event.log.transactionIndex),
              event.block.timestamp,
              event.eventName,
              event.signature,
              JSON.stringify(event.args),
              JSON.stringify(event.log),
              JSON.stringify(contract.abi),
              contract.version,
              event.decodeError,
              JSON.stringify(contract.release ?? null),
            ],
          );
          const saved = inserted[0];
          if (
            saved.fresh &&
            !event.decodeError &&
            event.eventName &&
            event.args
          ) {
            const rules = (
              await c.query<Rule>(
                'select * from alert_rules where project_id=$1 and enabled and event_name=$2 and (monitored_contract_id is null or monitored_contract_id=$3)',
                [monitor.project_id, event.eventName, monitor.id],
              )
            ).rows;
            for (const rule of rules) {
              let observed: unknown = event.args[rule.condition.field];
              if (rule.mode === 'count')
                observed = (
                  await c.query<{ count: string }>(
                    `select count(*)::text as count from monitoring_events where monitored_contract_id=$1 and event_name=$2 and not removed and decode_error is null
                and block_timestamp between $3::timestamptz-$4::int*interval '1 second' and $3::timestamptz`,
                    [
                      monitor.id,
                      event.eventName,
                      event.block.timestamp,
                      rule.window_seconds,
                    ],
                  )
                ).rows[0].count;
              if (matches(rule.condition, observed))
                await this.trigger(c, monitor, rule, saved.id, observed);
            }
          }
        }
        const invalidated = await c.query<{ id: string }>(
          `update monitoring_alerts a set invalidated_at=now() from monitoring_events e where a.event_id=e.id and e.monitored_contract_id=$1 and e.removed and a.invalidated_at is null returning a.id`,
          [monitor.id],
        );
        for (const alert of invalidated.rows) {
          await c.query(
            "insert into monitoring_alert_history(project_id,alert_id,action,note) values($1,$2,'invalidated','Triggering block/log removed by a chain reorganization')",
            [monitor.project_id, alert.id],
          );
          await c.query(
            "insert into monitoring_alert_outbox(project_id,alert_id,action,payload) values($1,$2,'invalidated',$3::jsonb) on conflict(alert_id,action) do nothing",
            [
              monitor.project_id,
              alert.id,
              JSON.stringify({
                projectId: monitor.project_id,
                alertId: alert.id,
                action: 'invalidated',
              }),
            ],
          );
        }
        await c.query(
          'update monitoring_alerts a set invalidated_at=null from monitoring_events e where a.event_id=e.id and e.monitored_contract_id=$1 and not e.removed and a.invalidated_at is not null',
          [monitor.id],
        );
        await this.finish(c, job, monitor, head, to);
      });
    } catch {
      // Never copy provider exception strings: they may contain RPC credentials.
      await this.db.query(
        `update monitoring_jobs set checked_at=now(),last_error=$3,failures=failures+1,
        next_run_at=now()+least(300,power(2,least(failures+1,8)))::int*interval '1 second',lease_token=null,lease_until=null
        where monitored_contract_id=$1 and lease_token=$2`,
        [job.monitored_contract_id, token, stage],
      );
    }
    return true;
  }
  private async trigger(
    c: pg.PoolClient,
    monitor: Watcher,
    rule: Rule,
    eventId: string,
    observed: unknown,
  ) {
    const { rows } = await c.query<{ id: string }>(
      `insert into monitoring_alerts(project_id,rule_id,event_id,title,severity,evidence) values($1,$2,$3,$4,$5,$6::jsonb)
      on conflict(rule_id,event_id) do nothing returning id`,
      [
        monitor.project_id,
        rule.id,
        eventId,
        rule.name,
        rule.severity,
        JSON.stringify({
          condition: rule.condition,
          observed,
          mode: rule.mode,
          windowSeconds: rule.window_seconds,
          eventId,
          registryContractId: monitor.registry_contract_id,
          registryVersion: monitor.registry_version,
        }),
      ],
    );
    if (!rows[0]) return;
    const id = rows[0].id;
    await c.query(
      "insert into monitoring_alert_history(project_id,alert_id,action) values($1,$2,'triggered')",
      [monitor.project_id, id],
    );
    await c.query(
      "insert into monitoring_alert_outbox(project_id,alert_id,action,payload) values($1,$2,'triggered',$3::jsonb)",
      [
        monitor.project_id,
        id,
        JSON.stringify({
          projectId: monitor.project_id,
          alertId: id,
          eventId,
          ruleId: rule.id,
          severity: rule.severity,
        }),
      ],
    );
  }
  private finish(
    c: Pick<pg.PoolClient, 'query'>,
    job: Job,
    monitor: Watcher,
    head: number,
    to: number | null,
  ) {
    return c.query(
      `update monitoring_jobs set checked_at=now(),succeeded_at=now(),last_error=null,failures=0,last_head_block=$3,
      last_indexed_block=case when $4::bigint is null then last_indexed_block else greatest(coalesce(last_indexed_block,$4),$4) end,
      next_run_at=now()+$5::int*interval '1 second',lease_token=null,lease_until=null where monitored_contract_id=$1 and lease_token=$2`,
      [monitor.id, job.lease_token, head, to, monitor.polling_seconds],
    );
  }
  private async complete(
    job: Job,
    monitor: Watcher,
    head: number,
    to: number | null,
  ) {
    await this.db.transaction(async (c) => {
      await this.finish(c, job, monitor, head, to);
    });
  }
}
