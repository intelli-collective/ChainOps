import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { MonitoringService } from './monitoring.service.js';
import { RegistryGateway } from './registry.gateway.js';
import { ChainGateway } from './chain.gateway.js';
import { eventCatalog } from './event-decoder.js';
import {
  inputObject,
  noteInput,
  pageInput,
  runtimeRuleInput,
  settingsInput,
  subscriptionInput,
  targetInput,
} from './runtime.validation.js';
import { uuid } from './monitoring.validation.js';

const watcherColumns = `m.id,m.project_id as "projectId",m.name,m.network,m.address,
  m.registry_contract_id as "registryContractId",m.registry_version as "registryVersion",
  m.enabled,m.polling_seconds as "pollingSeconds",m.confirmations,m.start_block::text as "startBlock",
  j.last_indexed_block::text as "lastIndexedBlock",j.last_head_block::text as "lastHeadBlock",
  j.checked_at as "checkedAt",j.succeeded_at as "succeededAt",j.last_error as "lastError",
  case when not m.enabled then 'paused' when j.last_error is not null then 'degraded'
    when j.succeeded_at is null or j.last_indexed_block is null then 'pending'
    when j.checked_at<now()-greatest(60,m.polling_seconds*3)*interval '1 second' then 'stale'
    when j.last_indexed_block<j.last_head_block-m.confirmations then 'catching_up' else 'healthy' end as status`;
const eventColumns = `e.id,e.project_id as "projectId",e.monitored_contract_id as "monitoredContractId",m.name as "contractName",m.address,e.network,
  e.event_name as "eventName",e.signature,e.decoded_args as args,e.raw_log as "rawLog",e.abi,e.registry_version as "registryVersion",e.release_context as "releaseContext",
  e.transaction_hash as "transactionHash",e.block_hash as "blockHash",e.block_number::text as "blockNumber",e.log_index as "logIndex",
  e.transaction_index as "transactionIndex",e.block_timestamp as timestamp,e.removed,e.decode_error as "decodeError"`;
const ruleColumns = `r.id,r.project_id as "projectId",r.monitored_contract_id as "monitoredContractId",m.name as "contractName",r.name,r.description,r.severity,r.mode,
  r.window_seconds as "windowSeconds",r.event_name as "eventName",r.condition,r.enabled,r.created_at as "createdAt"`;
const alertColumns = `a.id,a.project_id as "projectId",a.rule_id as "ruleId",a.event_id as "eventId",a.title,a.severity,a.status,a.evidence,
  a.acknowledged_at as "acknowledgedAt",a.resolved_at as "resolvedAt",a.invalidated_at as "invalidatedAt",a.created_at as "createdAt",
  m.name as "contractName",m.address,e.monitored_contract_id as "monitoredContractId",e.network,e.transaction_hash as "transactionHash",e.event_name as "eventName",
  e.block_number::text as "blockNumber",e.removed,u.full_name as "acknowledgedBy",v.full_name as "resolvedBy"`;
const alertJoins = `from monitoring_alerts a join monitoring_events e on e.id=a.event_id join monitored_contracts m on m.id=e.monitored_contract_id
  left join users u on u.id=a.acknowledged_by_id left join users v on v.id=a.resolved_by_id`;

@Injectable()
export class MonitoringRuntimeService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MonitoringService) private readonly config: MonitoringService,
    @Inject(RegistryGateway) private readonly registry: RegistryGateway,
    @Inject(ChainGateway) private readonly chain: ChainGateway,
  ) {}

  async projects(userId: string) {
    return (
      await this.db.query(
        `select p.id,p.name,o.name as "organizationName" from projects p join organizations o on o.id=p.organization_id
      join organization_members m on m.organization_id=p.organization_id where m.user_id=$1 order by o.name,p.name,p.id`,
        [userId],
      )
    ).rows;
  }
  registryContracts(projectId: string, userId: string) {
    return this.config.project(projectId, userId, () =>
      this.registry.list(projectId),
    );
  }
  async watchers(projectId: string, userId: string) {
    return this.config.project(projectId, userId, async (c) => ({
      rpcConfigured: this.chain.configured(),
      items: (
        await c.query(
          `select ${watcherColumns} from monitored_contracts m left join monitoring_jobs j on j.monitored_contract_id=m.id where m.project_id=$1 order by m.created_at,m.id`,
          [projectId],
        )
      ).rows,
    }));
  }
  async addTarget(projectId: string, userId: string, body: unknown) {
    const registryId = targetInput(body);
    try {
      return await this.config.project(projectId, userId, async (c) => {
        const contract = await this.registry.get(projectId, registryId);
        const { rows } = await c.query(
          `insert into monitored_contracts(project_id,name,network,address,registry_contract_id,registry_version)
          values($1,$2,$3,$4,$5,$6) returning id`,
          [
            projectId,
            contract.name,
            contract.network,
            contract.address,
            contract.id,
            contract.version,
          ],
        );
        await c.query(
          'insert into monitoring_jobs(monitored_contract_id) values($1)',
          [rows[0].id],
        );
        return { id: rows[0].id };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException(
          'This registry contract is already monitored',
        );
      throw error;
    }
  }
  private async watcher(
    c: pg.PoolClient,
    projectId: string,
    id: string,
    lock = false,
  ) {
    uuid(id);
    const { rows } = await c.query<{
      id: string;
      registry_contract_id: string | null;
      address: string;
      network: string;
      registry_version: string | null;
    }>(
      `select * from monitored_contracts where project_id=$1 and id=$2${lock ? ' for update' : ''}`,
      [projectId, id],
    );
    if (!rows[0]) throw new NotFoundException('Monitored contract not found');
    return rows[0];
  }
  catalog(projectId: string, userId: string, id: string) {
    return this.config.project(projectId, userId, async (c) => {
      const monitor = await this.watcher(c, projectId, id);
      const subscriptions = (
        await c.query(
          'select id,signature,enabled from monitoring_subscriptions where project_id=$1 and monitored_contract_id=$2 order by signature',
          [projectId, id],
        )
      ).rows;
      if (!monitor.registry_contract_id)
        return {
          available: false,
          message:
            'This interim target has no deployed M2 registry link or ABI.',
          events: [],
          abi: [],
          subscriptions,
        };
      const contract = await this.registry.get(
        projectId,
        monitor.registry_contract_id,
      );
      if (
        contract.address !== monitor.address ||
        contract.network !== monitor.network ||
        contract.version !== monitor.registry_version
      )
        throw new ConflictException(
          'Registry contract version or deployment changed; select the correct deployment',
        );
      return {
        available: true,
        message: null,
        events: eventCatalog(contract.abi),
        abi: contract.abi,
        subscriptions,
      };
    });
  }
  settings(projectId: string, userId: string, id: string, body: unknown) {
    const input = settingsInput(body);
    return this.config.project(projectId, userId, async (c) => {
      const monitor = await this.watcher(c, projectId, id, true);
      if (input.enabled) {
        if (!monitor.registry_contract_id)
          throw new BadRequestException(
            'Link a deployed registry contract before enabling indexing',
          );
        const subscriptions = await c.query(
          'select 1 from monitoring_subscriptions where monitored_contract_id=$1 and enabled limit 1',
          [id],
        );
        if (!subscriptions.rows.length)
          throw new BadRequestException(
            'Add an ABI event subscription before enabling indexing',
          );
      }
      // Never silently reset an existing indexing checkpoint through settings.
      const { rows } = await c.query(
        `update monitored_contracts set enabled=$3,polling_seconds=$4,confirmations=$5,
        start_block=case when start_block is null then $6::bigint else start_block end where project_id=$1 and id=$2
        returning id,enabled,polling_seconds as "pollingSeconds",confirmations,start_block::text as "startBlock"`,
        [
          projectId,
          id,
          input.enabled,
          input.pollingSeconds,
          input.confirmations,
          input.startBlock ?? null,
        ],
      );
      await c.query(
        `insert into monitoring_jobs(monitored_contract_id) values($1) on conflict(monitored_contract_id) do update set next_run_at=now(),lease_token=null,lease_until=null`,
        [id],
      );
      return rows[0];
    });
  }
  addSubscription(
    projectId: string,
    userId: string,
    id: string,
    body: unknown,
  ) {
    const signature = subscriptionInput(body);
    return this.config.project(projectId, userId, async (c) => {
      const monitor = await this.watcher(c, projectId, id, true);
      if (!monitor.registry_contract_id)
        throw new BadRequestException('Registered contract ABI is unavailable');
      const contract = await this.registry.get(
        projectId,
        monitor.registry_contract_id,
      );
      if (
        !eventCatalog(contract.abi).some(
          (event) => event.signature === signature,
        )
      )
        throw new BadRequestException(
          'Event signature is not in the registered ABI',
        );
      const { rows } = await c.query(
        `insert into monitoring_subscriptions(project_id,monitored_contract_id,signature) values($1,$2,$3)
        on conflict(monitored_contract_id,signature) do nothing returning id,signature,enabled`,
        [projectId, id, signature],
      );
      if (!rows[0])
        throw new ConflictException('Event subscription already exists');
      await c.query(
        'update monitoring_jobs set next_run_at=now(),lease_token=null,lease_until=null where monitored_contract_id=$1',
        [id],
      );
      return rows[0];
    });
  }
  removeSubscription(
    projectId: string,
    userId: string,
    id: string,
    subscriptionId: string,
  ) {
    uuid(subscriptionId);
    return this.config.project(projectId, userId, async (c) => {
      await this.watcher(c, projectId, id, true);
      const result = await c.query(
        'delete from monitoring_subscriptions where project_id=$1 and monitored_contract_id=$2 and id=$3 returning id',
        [projectId, id, subscriptionId],
      );
      if (!result.rows.length)
        throw new NotFoundException('Subscription not found');
      await c.query(
        'update monitoring_jobs set next_run_at=now(),lease_token=null,lease_until=null where monitored_contract_id=$1',
        [id],
      );
      return { ok: true };
    });
  }
  testConnection(projectId: string, userId: string) {
    return this.config.project(projectId, userId, async () => ({
      network: 'sepolia',
      headBlock: String(await this.chain.head()),
      checkedAt: new Date().toISOString(),
    }));
  }
  overview(projectId: string, userId: string, range: string) {
    const hours = range === '1h' ? 1 : range === '7d' ? 168 : 24;
    return this.config.project(projectId, userId, async (c) => {
      const project = (
        await c.query(
          'select p.name,o.name as "organizationName" from projects p join organizations o on o.id=p.organization_id where p.id=$1',
          [projectId],
        )
      ).rows[0];
      const monitors = (
        await c.query(
          `select ${watcherColumns} from monitored_contracts m left join monitoring_jobs j on j.monitored_contract_id=m.id where m.project_id=$1 order by m.created_at,m.id`,
          [projectId],
        )
      ).rows;
      const throughput = (
        await c.query(
          `select date_trunc('hour',block_timestamp) as time,event_name as "eventName",count(*)::int as count from monitoring_events
        where project_id=$1 and not removed and decode_error is null and block_timestamp>=now()-$2::int*interval '1 hour' group by 1,2 order by 1,2`,
          [projectId, hours],
        )
      ).rows;
      const rate = (
        await c.query(
          `select count(*)::int as count from monitoring_events where project_id=$1 and not removed and block_timestamp>=now()-interval '1 minute'`,
          [projectId],
        )
      ).rows[0].count;
      const alerts = (
        await c.query(
          `select ${alertColumns} ${alertJoins} where a.project_id=$1 order by a.created_at desc,a.id desc limit 4`,
          [projectId],
        )
      ).rows;
      return {
        project,
        monitors,
        throughput,
        eventRate: rate,
        alerts,
        rpcConfigured: this.chain.configured(),
        registryConfigured: Boolean(process.env.MONITORING_REGISTRY_API_URL),
        fetchedAt: new Date().toISOString(),
      };
    });
  }
  events(projectId: string, userId: string, query: Record<string, unknown>) {
    const page = pageInput(query),
      monitorId = query.monitoredContractId
        ? uuid(query.monitoredContractId)
        : null;
    const eventName =
      typeof query.eventName === 'string' ? query.eventName : null;
    if (eventName && !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(eventName))
      throw new BadRequestException('Invalid event filter');
    const date = (value: unknown) => {
      if (value === undefined || value === '') return null;
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
        throw new BadRequestException('Invalid UTC date');
      return new Date(value).toISOString();
    };
    const from = date(query.from),
      to = date(query.to);
    if (from && to && from > to)
      throw new BadRequestException('From must precede To');
    return this.config.project(projectId, userId, async (c) => {
      const args = [projectId, monitorId, eventName, from, to];
      const where =
        'e.project_id=$1 and ($2::uuid is null or e.monitored_contract_id=$2) and ($3::text is null or e.event_name=$3) and ($4::timestamptz is null or e.block_timestamp>=$4) and ($5::timestamptz is null or e.block_timestamp<=$5)';
      const total = (
        await c.query(
          `select count(*)::int as total from monitoring_events e where ${where}`,
          args,
        )
      ).rows[0].total;
      const items = (
        await c.query(
          `select ${eventColumns} from monitoring_events e join monitored_contracts m on m.id=e.monitored_contract_id where ${where}
        order by e.block_timestamp desc,e.block_number desc,e.log_index desc,e.id desc limit $6 offset $7`,
          [...args, page.limit, page.offset],
        )
      ).rows;
      return { items, total, page: page.page, limit: page.limit };
    });
  }
  event(projectId: string, userId: string, id: string) {
    uuid(id);
    return this.config.project(projectId, userId, async (c) => {
      const { rows } = await c.query(
        `select ${eventColumns} from monitoring_events e join monitored_contracts m on m.id=e.monitored_contract_id where e.project_id=$1 and e.id=$2`,
        [projectId, id],
      );
      if (!rows[0]) throw new NotFoundException('Event not found');
      const newer = (
        await c.query(
          `select id from monitoring_events where project_id=$1 and (block_timestamp,block_number,log_index,id)>(select block_timestamp,block_number,log_index,id from monitoring_events where id=$2)
        order by block_timestamp,block_number,log_index,id limit 1`,
          [projectId, id],
        )
      ).rows[0];
      const older = (
        await c.query(
          `select id from monitoring_events where project_id=$1 and (block_timestamp,block_number,log_index,id)<(select block_timestamp,block_number,log_index,id from monitoring_events where id=$2)
        order by block_timestamp desc,block_number desc,log_index desc,id desc limit 1`,
          [projectId, id],
        )
      ).rows[0];
      return {
        ...rows[0],
        previousId: newer?.id ?? null,
        nextId: older?.id ?? null,
      };
    });
  }
  rules(projectId: string, userId: string) {
    return this.config.project(
      projectId,
      userId,
      async (c) =>
        (
          await c.query(
            `select ${ruleColumns} from alert_rules r left join monitored_contracts m on m.id=r.monitored_contract_id where r.project_id=$1 order by r.created_at,r.id`,
            [projectId],
          )
        ).rows,
    );
  }
  createRule(projectId: string, userId: string, body: unknown) {
    const b = runtimeRuleInput(body);
    return this.config.project(projectId, userId, async (c) => {
      if (b.monitoredContractId)
        await this.watcher(c, projectId, b.monitoredContractId);
      const { rows } = await c.query(
        `insert into alert_rules(project_id,monitored_contract_id,name,event_name,condition,enabled,description,severity,mode,window_seconds)
        values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) returning id`,
        [
          projectId,
          b.monitoredContractId,
          b.name,
          b.eventName,
          JSON.stringify(b.condition),
          b.enabled,
          b.description,
          b.severity,
          b.mode,
          b.windowSeconds,
        ],
      );
      return rows[0];
    });
  }
  toggleRule(projectId: string, userId: string, id: string, body: unknown) {
    uuid(id);
    const b = inputObject(body, ['enabled']);
    if (typeof b.enabled !== 'boolean')
      throw new BadRequestException('enabled must be a boolean');
    return this.config.project(projectId, userId, async (c) => {
      const { rows } = await c.query(
        'update alert_rules set enabled=$3 where project_id=$1 and id=$2 returning id,enabled',
        [projectId, id, b.enabled],
      );
      if (!rows[0]) throw new NotFoundException('Rule not found');
      return rows[0];
    });
  }
  alerts(projectId: string, userId: string, query: Record<string, unknown>) {
    const page = pageInput(query);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search.length > 120)
      throw new BadRequestException('Search is too long');
    if (query.severity !== undefined && typeof query.severity !== 'string')
      throw new BadRequestException('Invalid severity');
    if (query.status !== undefined && typeof query.status !== 'string')
      throw new BadRequestException('Invalid status');
    const severity =
        typeof query.severity === 'string' && query.severity
          ? query.severity
          : null,
      status =
        typeof query.status === 'string' && query.status ? query.status : null;
    if (severity && !['info', 'warning', 'critical'].includes(severity))
      throw new BadRequestException('Invalid severity');
    if (status && !['open', 'acknowledged', 'resolved'].includes(status))
      throw new BadRequestException('Invalid status');
    const days = query.days === undefined ? 7 : Number(query.days);
    if (![1, 7, 30, 365].includes(days))
      throw new BadRequestException('Invalid period');
    return this.config.project(projectId, userId, async (c) => {
      const args = [projectId, search, severity, status, days];
      const where = `a.project_id=$1 and ($2::text='' or position(lower($2) in lower(a.title))>0) and ($3::text is null or a.severity=$3) and ($4::text is null or a.status=$4) and a.created_at>=now()-$5::int*interval '1 day'`;
      const total = (
        await c.query(
          `select count(*)::int as total ${alertJoins} where ${where}`,
          args,
        )
      ).rows[0].total;
      const items = (
        await c.query(
          `select ${alertColumns} ${alertJoins} where ${where} order by a.created_at desc,a.id desc limit $6 offset $7`,
          [...args, page.limit, page.offset],
        )
      ).rows;
      return { items, total, page: page.page, limit: page.limit };
    });
  }
  alert(projectId: string, userId: string, id: string) {
    uuid(id);
    return this.config.project(projectId, userId, async (c) => {
      const { rows } = await c.query(
        `select ${alertColumns} ${alertJoins} where a.project_id=$1 and a.id=$2`,
        [projectId, id],
      );
      if (!rows[0]) throw new NotFoundException('Alert not found');
      const history = (
        await c.query(
          `select h.id,h.action,h.note,h.created_at as "createdAt",u.full_name as "actorName" from monitoring_alert_history h left join users u on u.id=h.actor_id where h.project_id=$1 and h.alert_id=$2 order by h.created_at,h.id`,
          [projectId, id],
        )
      ).rows;
      return { ...rows[0], history };
    });
  }
  transition(
    projectId: string,
    userId: string,
    id: string,
    action: 'acknowledged' | 'resolved',
    body: unknown,
  ) {
    uuid(id);
    const note = noteInput(body);
    return this.config.project(projectId, userId, async (c) => {
      const { rows } = await c.query<{ status: string; removed: boolean }>(
        `select a.status,e.removed from monitoring_alerts a join monitoring_events e on e.id=a.event_id where a.project_id=$1 and a.id=$2 for update of a`,
        [projectId, id],
      );
      if (!rows[0]) throw new NotFoundException('Alert not found');
      if (rows[0].removed)
        throw new ConflictException(
          'The triggering event was removed by a chain reorganization',
        );
      if (
        rows[0].status === 'resolved' ||
        (action === 'acknowledged' && rows[0].status !== 'open')
      )
        throw new ConflictException(
          'Alert is already in this state or resolved',
        );
      // Static SQL branches only; action never becomes a user-selected SQL name.
      if (action === 'acknowledged')
        await c.query(
          "update monitoring_alerts set status='acknowledged',acknowledged_at=now(),acknowledged_by_id=$3 where project_id=$1 and id=$2",
          [projectId, id, userId],
        );
      else
        await c.query(
          "update monitoring_alerts set status='resolved',resolved_at=now(),resolved_by_id=$3 where project_id=$1 and id=$2",
          [projectId, id, userId],
        );
      await c.query(
        'insert into monitoring_alert_history(project_id,alert_id,action,actor_id,note) values($1,$2,$3,$4,$5)',
        [projectId, id, action, userId, note],
      );
      await c.query(
        'insert into monitoring_alert_outbox(project_id,alert_id,action,payload) values($1,$2,$3,$4::jsonb) on conflict(alert_id,action) do nothing',
        [
          projectId,
          id,
          action,
          JSON.stringify({ projectId, alertId: id, action, actorId: userId }),
        ],
      );
      return { id, status: action };
    });
  }
}
