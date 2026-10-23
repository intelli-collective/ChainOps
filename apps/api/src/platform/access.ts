import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';

export const ROLES = ['owner', 'developer', 'reviewer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Role permissions (enforced server-side; the UI only hides what the API refuses).
 * Organization owners administer the organization and every project in it.
 * Project owners administer their project. Developers can create projects.
 */
export const PERMISSIONS = {
  manageOrganization: ['owner'],
  createProject: ['owner', 'developer'],
  manageProject: ['owner'],
} as const satisfies Record<string, readonly Role[]>;

export interface OrgAccess {
  organizationId: string;
  role: Role;
}

/** 404 unless the user belongs to the organization (existence is not disclosed), 403 if the role is not allowed. */
export async function requireOrgRole(db: DatabaseService, organizationId: string, userId: string, allowed?: readonly Role[]): Promise<OrgAccess> {
  const { rows } = await db.query<{ role: Role }>(
    'select role from organization_members where organization_id = $1 and user_id = $2',
    [organizationId, userId],
  );
  if (!rows[0]) throw new NotFoundException('Organization not found');
  if (allowed && !allowed.includes(rows[0].role)) throw new ForbiddenException('Your organization role does not allow this action');
  return { organizationId, role: rows[0].role };
}

export interface ProjectAccess {
  projectId: string;
  organizationId: string;
  orgRole: Role;
  projectRole: Role | null;
  canManage: boolean;
}

/**
 * Project access follows organization membership (as the other modules do); managing a
 * project needs organization Owner or project Owner. 404 for missing projects and for
 * projects outside the user's organizations, 403 for insufficient role.
 */
export async function requireProject(db: DatabaseService, projectId: string, userId: string, action: 'read' | 'manage'): Promise<ProjectAccess> {
  const { rows } = await db.query<{ organization_id: string; org_role: Role | null; project_role: Role | null }>(
    `select p.organization_id, om.role as org_role, pm.role as project_role
       from projects p
       left join organization_members om on om.organization_id = p.organization_id and om.user_id = $2
       left join project_members pm on pm.project_id = p.id and pm.user_id = $2
      where p.id = $1`,
    [projectId, userId],
  );
  const row = rows[0];
  if (!row || !row.org_role) throw new NotFoundException('Project not found');
  const canManage = row.org_role === 'owner' || row.project_role === 'owner';
  if (action === 'manage' && !canManage) throw new ForbiddenException('Only project or organization owners can change this project');
  return { projectId, organizationId: row.organization_id, orgRole: row.org_role, projectRole: row.project_role, canManage };
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
