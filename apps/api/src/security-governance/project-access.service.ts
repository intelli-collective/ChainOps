import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';

/** The current access model is organization membership for a project's owner organization. */
@Injectable()
export class ProjectAccessService {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  async requireMember(projectId: string, req: Request): Promise<string> {
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.chainops_access;
    const { user } = await this.auth.authenticate(typeof cookie === 'string' ? cookie : undefined);
    const { rows } = await this.db.query<{ id: string; member_user_id: string | null }>(
      `select p.id, m.user_id as member_user_id
       from projects p
       left join organization_members m
         on m.organization_id = p.organization_id and m.user_id = $2
       where p.id = $1`,
      [projectId, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Project not found');
    if (!rows[0].member_user_id) throw new ForbiddenException('Project access denied');
    return user.id;
  }
}
