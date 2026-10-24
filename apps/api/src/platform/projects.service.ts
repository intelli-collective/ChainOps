import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { PERMISSIONS, requireOrgRole, requireProject, type Role } from './access.js';
import { InvitationsService, presentInvitation, type InvitationRow, type SentInvitation } from './invitations.service.js';
import { body, email, oneOf, optionalText, role, slugify, text } from './validation.js';

const FRAMEWORKS = ['hardhat', 'foundry', 'other'] as const;
const STATUSES = ['active', 'paused', 'archived'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH = /^[A-Za-z0-9._/-]{1,255}$/;

interface ProjectRow {
  id: string; organization_id: string; organization_name: string; organization_slug: string; name: string; slug: string;
  description: string | null; status: string; framework: string; default_branch: string; setup_completed_at: Date | null;
  created_at: Date; updated_at: Date; created_by_id: string; owner_name: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
  ) {}

  private async row(projectId: string): Promise<ProjectRow> {
    const { rows } = await this.db.query<ProjectRow>(
      `select p.*, o.name as organization_name, o.slug as organization_slug, u.full_name as owner_name
         from projects p join organizations o on o.id = p.organization_id left join users u on u.id = p.created_by_id where p.id = $1`, [projectId]);
    if (!rows[0]) throw new NotFoundException('Project not found');
    return rows[0];
  }

  private present(row: ProjectRow, access: { orgRole: Role; projectRole: Role | null; canManage: boolean }) {
    return {
      id: row.id, organizationId: row.organization_id, organizationName: row.organization_name, organizationSlug: row.organization_slug,
      name: row.name, slug: row.slug, description: row.description, status: row.status, framework: row.framework,
      defaultBranch: row.default_branch, setupComplete: row.setup_completed_at !== null, ownerName: row.owner_name,
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
      access: { organizationRole: access.orgRole, projectRole: access.projectRole, canManage: access.canManage },
    };
  }

  /** Resolves a project by id or slug, limited to the user's organizations. */
  async get(userId: string, ref: string) {
    let projectId = ref;
    if (!UUID.test(ref)) {
      const { rows } = await this.db.query<{ id: string }>(
        `select p.id from projects p join organization_members m on m.organization_id = p.organization_id and m.user_id = $2
          where p.slug = $1 order by p.created_at limit 1`, [ref, userId]);
      if (!rows[0]) throw new NotFoundException('Project not found');
      projectId = rows[0].id;
    }
    const access = await requireProject(this.db, projectId, userId, 'read');
    return this.present(await this.row(projectId), access);
  }

  /** Wizard step 1: creates the project in setup state with the creator as project Owner. */
  async create(userId: string, organizationId: string, input: unknown) {
    const access = await requireOrgRole(this.db, organizationId, userId, PERMISSIONS.createProject);
    const b = body(input, ['name', 'description', 'framework', 'defaultBranch']);
    const name = text(b.name, 'Project name', 120)!;
    const description = optionalText(b.description, 'Description', 500) ?? null;
    const framework = b.framework === undefined ? 'hardhat' : oneOf(b.framework, FRAMEWORKS, 'framework');
    const defaultBranch = b.defaultBranch === undefined ? 'main' : b.defaultBranch;
    if (typeof defaultBranch !== 'string' || !BRANCH.test(defaultBranch) || defaultBranch.includes('..')) throw new BadRequestException('defaultBranch must be a valid branch name.');
    const base = slugify(name);
    const id = await this.db.transaction(async (client: pg.PoolClient) => {
      const taken = new Set((await client.query<{ slug: string }>('select slug from projects where organization_id = $1 and slug like $2', [organizationId, `${base}%`])).rows.map((r) => r.slug));
      let projectSlug = base;
      for (let n = 2; taken.has(projectSlug); n += 1) projectSlug = `${base}-${n}`;
      const { rows } = await client.query<{ id: string }>(
        `insert into projects (organization_id, name, slug, description, framework, default_branch, created_by_id, setup_completed_at)
         values ($1, $2, $3, $4, $5, $6, $7, null) returning id`,
        [organizationId, name, projectSlug, description, framework, defaultBranch, userId]);
      await client.query("insert into project_members (project_id, user_id, role) values ($1, $2, 'owner')", [rows[0].id, userId]);
      return rows[0].id;
    });
    return this.present(await this.row(id), { orgRole: access.role, projectRole: 'owner', canManage: true });
  }

  async update(userId: string, projectId: string, input: unknown) {
    const access = await requireProject(this.db, projectId, userId, 'manage');
    const b = body(input, ['name', 'description', 'framework', 'defaultBranch', 'status']);
    const sets: string[] = [];
    const values: unknown[] = [projectId];
    const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
    if (b.name !== undefined) set('name', text(b.name, 'Project name', 120));
    if (b.description !== undefined) set('description', optionalText(b.description, 'Description', 500));
    if (b.framework !== undefined) set('framework', oneOf(b.framework, FRAMEWORKS, 'framework'));
    if (b.status !== undefined) set('status', oneOf(b.status, STATUSES, 'status'));
    if (b.defaultBranch !== undefined) {
      if (typeof b.defaultBranch !== 'string' || !BRANCH.test(b.defaultBranch) || b.defaultBranch.includes('..')) throw new BadRequestException('defaultBranch must be a valid branch name.');
      set('default_branch', b.defaultBranch);
    }
    if (!sets.length) throw new BadRequestException('Provide at least one field to change.');
    await this.db.query(`update projects set ${sets.join(', ')} where id = $1`, values);
    return this.present(await this.row(projectId), access);
  }

  async team(userId: string, projectId: string) {
    const access = await requireProject(this.db, projectId, userId, 'read');
    const members = await this.db.query<{ id: string; full_name: string; email: string; role: Role; added_at: Date }>(
      `select u.id, u.full_name, u.email, pm.role, pm.added_at from project_members pm join users u on u.id = pm.user_id
        where pm.project_id = $1 order by (pm.role = 'owner') desc, pm.added_at`, [projectId]);
    const invitations = await this.db.query<InvitationRow>(
      "select * from invitations where project_id = $1 and status in ('draft', 'pending') order by created_at", [projectId]);
    return {
      canManage: access.canManage,
      members: members.rows.map((m) => ({ userId: m.id, fullName: m.full_name, email: m.email, role: m.role, addedAt: m.added_at.toISOString(), status: 'active', isYou: m.id === userId })),
      invitations: invitations.rows.map(presentInvitation),
    };
  }

  /** Project invitation. During setup it is saved as a draft and sent when the project is created (step 5). */
  async invite(userId: string, projectId: string, input: unknown): Promise<SentInvitation> {
    const access = await requireProject(this.db, projectId, userId, 'manage');
    const b = body(input, ['email', 'role']);
    const project = await this.row(projectId);
    return this.invitations.create({ organizationId: access.organizationId, projectId, email: email(b.email), role: role(b.role), invitedBy: userId, draft: project.setup_completed_at === null });
  }

  async revokeInvitation(userId: string, projectId: string, invitationId: string) {
    const access = await requireProject(this.db, projectId, userId, 'manage');
    return this.invitations.revoke(invitationId, { organizationId: access.organizationId, projectId });
  }

  async changeMemberRole(userId: string, projectId: string, memberId: string, input: unknown) {
    await requireProject(this.db, projectId, userId, 'manage');
    const next = role(body(input, ['role']).role);
    return this.db.transaction(async (client: pg.PoolClient) => {
      const { rows } = await client.query<{ role: Role }>('select role from project_members where project_id = $1 and user_id = $2 for update', [projectId, memberId]);
      if (!rows[0]) throw new NotFoundException('Project member not found');
      const owners = (await client.query<{ n: number }>("select count(*)::int n from project_members where project_id = $1 and role = 'owner'", [projectId])).rows[0].n;
      if (rows[0].role === 'owner' && next !== 'owner' && owners <= 1) throw new ConflictException('A project needs at least one Owner.');
      await client.query('update project_members set role = $3 where project_id = $1 and user_id = $2', [projectId, memberId, next]);
      return { userId: memberId, role: next };
    });
  }

  /** Wizard step 5: marks setup complete and sends the queued invitations. */
  async completeSetup(userId: string, projectId: string) {
    await requireProject(this.db, projectId, userId, 'manage');
    const project = await this.row(projectId);
    if (project.setup_completed_at) throw new ConflictException('Project setup is already complete.');
    const config = await this.db.query('select 1 from pipeline_configs where project_id = $1', [projectId]);
    if (!config.rowCount) throw new ConflictException('Connect a repository and configure the pipeline before creating the project.');
    await this.db.query('update projects set setup_completed_at = now() where id = $1', [projectId]);
    const drafts = await this.db.query<InvitationRow>("select * from invitations where project_id = $1 and status = 'draft' order by created_at", [projectId]);
    const sent: SentInvitation[] = [];
    for (const draft of drafts.rows) sent.push(await this.invitations.send(draft));
    return { projectId, invitations: sent };
  }

  /** Dashboard summary read from each module's own tables (no copies are stored here). */
  async overview(userId: string, projectId: string) {
    await requireProject(this.db, projectId, userId, 'read');
    const q = async <T extends pg.QueryResultRow>(sql: string) => (await this.db.query<T>(sql, [projectId])).rows;
    const [config] = await q<{ repository: string; branch: string }>('select repository, branch from pipeline_configs where project_id = $1');
    const runs = await q<{ id: string; run_number: number; commit_sha: string; status: string; branch: string; started_at: Date | null; finished_at: Date | null; queued_at: Date }>(
      'select id, run_number, commit_sha, status, branch, started_at, finished_at, queued_at from pipeline_runs where project_id = $1 order by run_number desc limit 5');
    const latestStages = runs[0]
      ? (await this.db.query<{ key: string; status: string }>('select key, status from pipeline_run_stages where run_id = $1 order by position', [runs[0].id])).rows
      : [];
    const [approvals] = await q<{ total: number; pending: number; latest_title: string | null; latest_status: string | null }>(
      `select count(*)::int as total, count(*) filter (where lower(status) = 'pending')::int as pending,
              (select title from approval_requests where project_id = $1 order by created_at desc limit 1) as latest_title,
              (select status from approval_requests where project_id = $1 order by created_at desc limit 1) as latest_status
         from approval_requests where project_id = $1`);
    const [policies] = await q<{ n: number }>('select count(*)::int n from security_policies where project_id = $1');
    const [contracts] = await q<{ n: number; latest: string | null }>("select count(*)::int n, (select name || ' ' || version from contract_artifacts where project_id = $1 order by created_at desc limit 1) as latest from contract_artifacts where project_id = $1");
    const [monitoring] = await q<{ contracts: number; rules: number }>('select (select count(*)::int from monitored_contracts where project_id = $1) as contracts, (select count(*)::int from alert_rules where project_id = $1) as rules');
    const environments = await q<{ name: string; network: string; chain_id: string; last_check_ok: boolean | null }>('select name, network, chain_id, last_check_ok from environments where project_id = $1 order by created_at');
    const activity = await q<{ day: Date; runs: number }>(
      `select d::date as day, (select count(*)::int from pipeline_runs r where r.project_id = $1 and r.queued_at::date = d::date) as runs
         from generate_series(current_date - 13, current_date, interval '1 day') d order by d`);
    return {
      repository: config ?? null,
      environments: environments.map((e) => ({ name: e.name, network: e.network, chainId: Number(e.chain_id), healthy: e.last_check_ok })),
      latestRun: runs[0] ? { id: runs[0].id, runNumber: runs[0].run_number, commitSha: runs[0].commit_sha, status: runs[0].status, stages: latestStages } : null,
      recentRuns: runs.map((r) => ({
        id: r.id, runNumber: r.run_number, commitSha: r.commit_sha, status: r.status, branch: r.branch, queuedAt: r.queued_at.toISOString(),
        durationSeconds: r.started_at && r.finished_at ? Math.round((r.finished_at.getTime() - r.started_at.getTime()) / 1000) : null,
      })),
      security: { policies: policies.n },
      approvals: { total: approvals.total, pending: approvals.pending, latestTitle: approvals.latest_title, latestStatus: approvals.latest_status },
      contracts: { artifacts: contracts.n, latest: contracts.latest },
      monitoring: { contracts: monitoring.contracts, alertRules: monitoring.rules },
      activity: activity.map((a) => ({ day: a.day.toISOString().slice(0, 10), runs: a.runs })),
    };
  }
}
