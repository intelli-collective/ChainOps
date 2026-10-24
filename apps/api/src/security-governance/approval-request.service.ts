import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { ApprovalRequestRow } from './security-governance.types.js';
import type { CreateApprovalRequestDto } from './approval-request.dto.js';

function toApprovalRequest(row: ApprovalRequestRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    requestedById: row.requested_by_id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class ApprovalRequestService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async create(projectId: string, requesterId: string, input: CreateApprovalRequestDto) {
    const { rows } = await this.db.query<ApprovalRequestRow>(
      `insert into approval_requests
         (project_id, title, description, requested_by_id)
       values ($1, $2, $3, $4)
       returning *`,
      [projectId, input.title, input.description, requesterId],
    );
    return toApprovalRequest(rows[0]);
  }

  async list(projectId: string) {
    const { rows } = await this.db.query<ApprovalRequestRow>(
      `select * from approval_requests
       where project_id = $1
       order by created_at desc, id desc`,
      [projectId],
    );
    return rows.map(toApprovalRequest);
  }
}
