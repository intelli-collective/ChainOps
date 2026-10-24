import { BadRequestException, Controller, Get, Inject, NotFoundException, Query, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AccessTokenGuard, type AuthenticatedRequest } from './access-token.guard.js';

// Interim helper for M1 pages: the web routes use project slugs (e.g. /projects/chainvault)
// while the API uses UUIDs. Returns only projects in the caller's organizations.
// Replace with the platform projects API (M5) once it exists.
@Controller('pipeline-projects')
@UseGuards(AccessTokenGuard)
export class ProjectLookupController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Get('lookup')
  async lookup(@Req() req: AuthenticatedRequest, @Query('ref') ref?: string) {
    if (!ref || ref.length > 80) throw new BadRequestException('Query parameter "ref" (project id or slug) is required.');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const { rows } = await this.db.query<{ id: string; name: string; slug: string; framework: string; organization_name: string }>(
      `select p.id, p.name, p.slug, p.framework, o.name as organization_name
         from projects p
         join organizations o on o.id = p.organization_id
         join organization_members m on m.organization_id = p.organization_id and m.user_id = $2
        where ${isUuid ? 'p.id = $1::uuid' : 'p.slug = $1'}
        order by p.created_at limit 2`,
      [ref, req.userId],
    );
    if (!rows[0]) throw new NotFoundException('Project not found in your organizations');
    const project = rows[0];
    return { id: project.id, name: project.name, slug: project.slug, framework: project.framework, organizationName: project.organization_name };
  }
}
