import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import type { PipelineFramework } from './pipeline-config.validation.js';

export interface PipelineProject {
  id: string;
  name: string;
  slug: string;
  framework: PipelineFramework;
}

// 404 when the project does not exist, 403 when the user is not a member of its organization.
// Every M1 endpoint calls this before touching project data.
export async function requireProjectMember(db: DatabaseService, projectId: string, userId: string): Promise<PipelineProject> {
  const { rows } = await db.query<PipelineProject & { is_member: boolean }>(
    `select p.id, p.name, p.slug, p.framework,
            exists(select 1 from organization_members m where m.organization_id = p.organization_id and m.user_id = $2) as is_member
       from projects p where p.id = $1`,
    [projectId, userId],
  );
  if (!rows[0]) throw new NotFoundException('Project not found');
  if (!rows[0].is_member) throw new ForbiddenException('You are not a member of this project\'s organization');
  const { is_member: _member, ...project } = rows[0];
  return project;
}
