import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SecurityPolicyRow } from './security-governance.types.js';
import type { CreateSecurityPolicyDto } from './security-policy.dto.js';

function toPolicy(row: SecurityPolicyRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    blockCritical: row.block_critical,
    blockHigh: row.block_high,
    requireApproval: row.require_approval,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class SecurityPolicyService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async create(projectId: string, input: CreateSecurityPolicyDto) {
    const { rows } = await this.db.query<SecurityPolicyRow>(
      `insert into security_policies
         (project_id, name, block_critical, block_high, require_approval)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [projectId, input.name, input.blockCritical, input.blockHigh, input.requireApproval],
    );
    return toPolicy(rows[0]);
  }

  async list(projectId: string) {
    const { rows } = await this.db.query<SecurityPolicyRow>(
      `select * from security_policies
       where project_id = $1
       order by created_at desc, id desc`,
      [projectId],
    );
    return rows.map(toPolicy);
  }
}
