import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { monitorInput, ruleInput, uuid } from './monitoring.validation.js';

const monitorColumns =
  'id, project_id as "projectId", name, network, address, created_at as "createdAt", updated_at as "updatedAt"';
const ruleColumns =
  'id, project_id as "projectId", monitored_contract_id as "monitoredContractId", name, event_name as "eventName", condition, enabled, created_at as "createdAt", updated_at as "updatedAt"';

@Injectable()
export class MonitoringService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async project<T>(
    projectId: string,
    userId: string,
    work: (client: pg.PoolClient) => Promise<T>,
  ) {
    uuid(projectId);
    return this.db.transaction(async (client) => {
      // Lock membership for the duration of the operation to serialize revocation.
      const membership = await client.query(
        `select p.id from projects p
        join organization_members m on m.organization_id=p.organization_id
        where p.id=$1 and m.user_id=$2 for share of p,m`,
        [projectId, userId],
      );
      // Conceal whether a project outside the caller's organization exists.
      if (!membership.rows.length)
        throw new NotFoundException('Project not found or inaccessible');
      return work(client);
    });
  }

  async createMonitor(projectId: string, userId: string, body: unknown) {
    const input = monitorInput(body);
    try {
      return await this.project(projectId, userId, async (client) => {
        const { rows } = await client.query(
          `insert into monitored_contracts(project_id,name,network,address)
          values($1,$2,$3,$4) returning ${monitorColumns}`,
          [projectId, input.name, input.network, input.address],
        );
        return rows[0];
      });
    } catch (error) {
      if (
        (error as { code?: string; constraint?: string }).code === '23505' &&
        (error as { constraint?: string }).constraint ===
          'monitored_contracts_project_network_address_key'
      ) {
        throw new ConflictException(
          'This address is already monitored on this project and network',
        );
      }
      throw error;
    }
  }

  listMonitors(projectId: string, userId: string) {
    return this.project(projectId, userId, async (client) => {
      const { rows } = await client.query(
        `select ${monitorColumns} from monitored_contracts where project_id=$1 order by created_at,id`,
        [projectId],
      );
      return rows;
    });
  }

  createRule(projectId: string, userId: string, body: unknown) {
    const input = ruleInput(body);
    return this.project(projectId, userId, async (client) => {
      if (input.monitoredContractId) {
        const monitor = await client.query(
          'select id from monitored_contracts where id=$1 and project_id=$2 for share',
          [input.monitoredContractId, projectId],
        );
        if (!monitor.rows.length)
          throw new NotFoundException(
            'Monitored contract not found in this project',
          );
      }
      const { rows } = await client.query(
        `insert into alert_rules(project_id,monitored_contract_id,name,event_name,condition,enabled)
        values($1,$2,$3,$4,$5::jsonb,$6) returning ${ruleColumns}`,
        [
          projectId,
          input.monitoredContractId,
          input.name,
          input.eventName,
          JSON.stringify(input.condition),
          input.enabled,
        ],
      );
      return rows[0];
    });
  }

  listRules(projectId: string, userId: string) {
    return this.project(projectId, userId, async (client) => {
      const { rows } = await client.query(
        `select ${ruleColumns} from alert_rules where project_id=$1 order by created_at,id`,
        [projectId],
      );
      return rows;
    });
  }
}
