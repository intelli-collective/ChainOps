import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { PERMISSIONS, requireOrgRole, type Role } from './access.js';
import { InvitationsService, presentInvitation, type InvitationRow } from './invitations.service.js';
import { body, email, oneOf, role, slug, text } from './validation.js';

const TEAM_SIZES = ['1', '2-10', '11-50', '51+'] as const;

interface OrganizationRow { id: string; name: string; slug: string; team_size: string | null; created_at: Date; role?: Role }

const presentOrg = (row: OrganizationRow) => ({ id: row.id, name: row.name, slug: row.slug, teamSize: row.team_size, createdAt: row.created_at.toISOString(), ...(row.role ? { role: row.role } : {}) });

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
  ) {}

  async mine(userId: string) {
    const { rows } = await this.db.query<OrganizationRow>(
      `select o.*, m.role from organizations o join organization_members m on m.organization_id = o.id
        where m.user_id = $1 order by m.joined_at, o.id`, [userId]);
    return rows.map(presentOrg);
  }

  /** Organization onboarding: creates the workspace with the creator as Owner. */
  async create(userId: string, input: unknown) {
    const b = body(input, ['name', 'slug', 'teamSize']);
    const name = text(b.name, 'name', 120)!;
    const orgSlug = slug(b.slug, 'Organization slug');
    const teamSize = b.teamSize === undefined || b.teamSize === null ? null : oneOf(b.teamSize, TEAM_SIZES, 'teamSize');
    try {
      const row = await this.db.transaction(async (client: pg.PoolClient) => {
        const { rows } = await client.query<OrganizationRow>('insert into organizations (name, slug, team_size, created_by_id) values ($1, $2, $3, $4) returning *', [name, orgSlug, teamSize, userId]);
        await client.query("insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [rows[0].id, userId]);
        return rows[0];
      });
      return presentOrg({ ...row, role: 'owner' });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('That organization slug is already taken.');
      throw error;
    }
  }

  async get(userId: string, organizationId: string) {
    const access = await requireOrgRole(this.db, organizationId, userId);
    const { rows } = await this.db.query<OrganizationRow>('select * from organizations where id = $1', [organizationId]);
    return { ...presentOrg(rows[0]), role: access.role, permissions: this.permissions(access.role) };
  }

  permissions(r: Role) {
    return { manageOrganization: (PERMISSIONS.manageOrganization as readonly Role[]).includes(r), createProject: (PERMISSIONS.createProject as readonly Role[]).includes(r) };
  }

  async update(userId: string, organizationId: string, input: unknown) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    const b = body(input, ['name', 'slug', 'teamSize']);
    const sets: string[] = [];
    const values: unknown[] = [organizationId];
    if (b.name !== undefined) { values.push(text(b.name, 'name', 120)); sets.push(`name = $${values.length}`); }
    if (b.slug !== undefined) { values.push(slug(b.slug, 'Organization slug')); sets.push(`slug = $${values.length}`); }
    if (b.teamSize !== undefined) { values.push(b.teamSize === null ? null : oneOf(b.teamSize, TEAM_SIZES, 'teamSize')); sets.push(`team_size = $${values.length}`); }
    if (!sets.length) throw new BadRequestException('Provide name, slug or teamSize.');
    try {
      const { rows } = await this.db.query<OrganizationRow>(`update organizations set ${sets.join(', ')} where id = $1 returning *`, values);
      return presentOrg(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('That organization slug is already taken.');
      throw error;
    }
  }

  async members(userId: string, organizationId: string) {
    const access = await requireOrgRole(this.db, organizationId, userId);
    const members = await this.db.query<{ id: string; full_name: string; email: string; role: Role; joined_at: Date; projects: number }>(
      `select u.id, u.full_name, u.email, m.role, m.joined_at,
              (select count(*)::int from project_members pm join projects p on p.id = pm.project_id where pm.user_id = u.id and p.organization_id = m.organization_id) as projects
         from organization_members m join users u on u.id = m.user_id where m.organization_id = $1 order by m.joined_at, u.full_name`,
      [organizationId]);
    const invitations = access.role === 'owner'
      ? (await this.db.query<InvitationRow>("select * from invitations where organization_id = $1 and project_id is null and status = 'pending' order by created_at desc", [organizationId])).rows.map(presentInvitation)
      : [];
    return {
      role: access.role,
      canManage: access.role === 'owner',
      members: members.rows.map((m) => ({ userId: m.id, fullName: m.full_name, email: m.email, role: m.role, joinedAt: m.joined_at.toISOString(), status: 'active', projectCount: m.projects, isYou: m.id === userId })),
      invitations,
    };
  }

  private async ownerCount(client: pg.PoolClient, organizationId: string) {
    const { rows } = await client.query<{ n: number }>("select count(*)::int n from organization_members where organization_id = $1 and role = 'owner'", [organizationId]);
    return rows[0].n;
  }

  async changeRole(userId: string, organizationId: string, memberId: string, input: unknown) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    const next = role(body(input, ['role']).role);
    return this.db.transaction(async (client: pg.PoolClient) => {
      const { rows } = await client.query<{ role: Role }>('select role from organization_members where organization_id = $1 and user_id = $2 for update', [organizationId, memberId]);
      if (!rows[0]) throw new NotFoundException('Member not found');
      if (rows[0].role === 'owner' && next !== 'owner' && await this.ownerCount(client, organizationId) <= 1) throw new ConflictException('An organization needs at least one Owner.');
      await client.query('update organization_members set role = $3 where organization_id = $1 and user_id = $2', [organizationId, memberId, next]);
      return { userId: memberId, role: next };
    });
  }

  async removeMember(userId: string, organizationId: string, memberId: string) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    return this.db.transaction(async (client: pg.PoolClient) => {
      const { rows } = await client.query<{ role: Role }>('select role from organization_members where organization_id = $1 and user_id = $2 for update', [organizationId, memberId]);
      if (!rows[0]) throw new NotFoundException('Member not found');
      if (rows[0].role === 'owner' && await this.ownerCount(client, organizationId) <= 1) throw new ConflictException('An organization needs at least one Owner.');
      await client.query('delete from project_members where user_id = $2 and project_id in (select id from projects where organization_id = $1)', [organizationId, memberId]);
      await client.query('delete from organization_members where organization_id = $1 and user_id = $2', [organizationId, memberId]);
      return { ok: true };
    });
  }

  async invite(userId: string, organizationId: string, input: unknown) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    const b = body(input, ['email', 'role']);
    return this.invitations.create({ organizationId, projectId: null, email: email(b.email), role: role(b.role), invitedBy: userId, draft: false });
  }

  async revokeInvitation(userId: string, organizationId: string, invitationId: string) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    return this.invitations.revoke(invitationId, { organizationId });
  }

  async integrations(userId: string, organizationId: string) {
    const access = await requireOrgRole(this.db, organizationId, userId);
    const { rows } = await this.db.query<{ account_login: string; account_type: string; access_mode: string; connected_at: Date; last_checked_at: Date; connected_by: string | null }>(
      `select i.account_login, i.account_type, i.access_mode, i.connected_at, i.last_checked_at, u.full_name as connected_by
         from organization_integrations i left join users u on u.id = i.connected_by where i.organization_id = $1 and i.provider = 'github'`,
      [organizationId]);
    const github = rows[0];
    return {
      canManage: access.role === 'owner',
      github: github
        ? { status: 'connected', account: github.account_login, accountType: github.account_type, accessMode: github.access_mode, connectedBy: github.connected_by, connectedAt: github.connected_at.toISOString(), lastCheckedAt: github.last_checked_at.toISOString() }
        : { status: 'not_connected' },
      // A GitHub App (private repositories, webhooks) needs app credentials that are not configured.
      githubApp: { configured: false },
    };
  }

  /** Links a GitHub user/organization after checking it exists. Only public repositories are used; no token is stored. */
  async connectGitHub(userId: string, organizationId: string, input: unknown) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    const account = body(input, ['account']).account;
    if (typeof account !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(account)) throw new BadRequestException('account must be a GitHub user or organization name.');
    const response = await fetch(`https://api.github.com/users/${account}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ChainOps', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(15000),
    }).catch(() => { throw new BadGatewayException('GitHub could not be reached.'); });
    if (response.status === 404) throw new NotFoundException(`GitHub account "${account}" was not found.`);
    if (!response.ok) throw new BadGatewayException(response.status === 403 ? 'GitHub API rate limit reached. Try again later.' : `GitHub returned ${response.status}.`);
    const profile = (await response.json()) as { login: string; type: 'User' | 'Organization' };
    await this.db.query(
      `insert into organization_integrations (organization_id, provider, account_login, account_type, connected_by)
       values ($1, 'github', $2, $3, $4)
       on conflict (organization_id, provider) do update set account_login = excluded.account_login, account_type = excluded.account_type,
         connected_by = excluded.connected_by, connected_at = now(), last_checked_at = now()`,
      [organizationId, profile.login, profile.type === 'Organization' ? 'Organization' : 'User', userId]);
    return this.integrations(userId, organizationId);
  }

  async disconnectGitHub(userId: string, organizationId: string) {
    await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.manageOrganization);
    await this.db.query("delete from organization_integrations where organization_id = $1 and provider = 'github'", [organizationId]);
    return this.integrations(userId, organizationId);
  }

  /** Organization project overview, with summaries read from the pipeline and environment tables. */
  async projects(userId: string, organizationId: string) {
    const access = await requireOrgRole(this.db, organizationId, userId);
    const { rows } = await this.db.query<{
      id: string; name: string; slug: string; description: string | null; status: string; framework: string; default_branch: string;
      setup_completed_at: Date | null; created_at: Date; repository: string | null; network: string | null;
      run_number: number | null; run_status: string | null;
    }>(
      `select p.id, p.name, p.slug, p.description, p.status, p.framework, p.default_branch, p.setup_completed_at, p.created_at,
              c.repository,
              (select e.name from environments e where e.project_id = p.id order by e.created_at limit 1) as network,
              r.run_number, r.status as run_status
         from projects p
         left join pipeline_configs c on c.project_id = p.id
         left join lateral (select run_number, status from pipeline_runs where project_id = p.id order by run_number desc limit 1) r on true
        where p.organization_id = $1 order by p.created_at`,
      [organizationId]);
    return {
      canCreate: (PERMISSIONS.createProject as readonly Role[]).includes(access.role),
      projects: rows.map((row) => ({
        id: row.id, name: row.name, slug: row.slug, description: row.description, status: row.status, framework: row.framework,
        defaultBranch: row.default_branch, setupComplete: row.setup_completed_at !== null, createdAt: row.created_at.toISOString(),
        repository: row.repository, network: row.network,
        lastRun: row.run_number === null ? null : { runNumber: row.run_number, status: row.run_status },
      })),
    };
  }
}
