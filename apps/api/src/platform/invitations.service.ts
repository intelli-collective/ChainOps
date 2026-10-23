import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import type { Role } from './access.js';
import { NotificationsService } from './notifications.service.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export interface InvitationRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  email: string;
  role: Role;
  status: 'draft' | 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

export const presentInvitation = (row: InvitationRow) => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  email: row.email,
  role: row.role,
  // Pending invitations past their expiry are reported as expired.
  status: row.status === 'pending' && row.expires_at.getTime() < Date.now() ? 'expired' : row.status,
  expiresAt: row.expires_at.toISOString(),
  createdAt: row.created_at.toISOString(),
});

export interface SentInvitation {
  invitation: ReturnType<typeof presentInvitation>;
  // Shareable link for the invitee; also emailed when SMTP is configured.
  inviteLink: string | null;
  delivery: 'email' | 'link' | 'draft';
}

/**
 * Invitations to an organization or a project. Tokens are random and only their hash
 * is stored. Access is granted only when the signed-in user whose email matches accepts.
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async create(input: { organizationId: string; projectId: string | null; email: string; role: Role; invitedBy: string; draft: boolean }): Promise<SentInvitation> {
    const member = input.projectId
      ? await this.db.query('select 1 from project_members pm join users u on u.id = pm.user_id where pm.project_id = $1 and u.email = $2', [input.projectId, input.email])
      : await this.db.query('select 1 from organization_members om join users u on u.id = om.user_id where om.organization_id = $1 and u.email = $2', [input.organizationId, input.email]);
    if (member.rowCount) throw new ConflictException(`${input.email} is already a member.`);
    // Expire stale invitations so they do not block a new one.
    await this.db.query("update invitations set status = 'expired' where status = 'pending' and expires_at < now() and email = $1", [input.email]);
    try {
      const { rows } = await this.db.query<InvitationRow>(
        `insert into invitations (organization_id, project_id, email, role, status, invited_by)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [input.organizationId, input.projectId, input.email, input.role, input.draft ? 'draft' : 'pending', input.invitedBy],
      );
      if (input.draft) return { invitation: presentInvitation(rows[0]), inviteLink: null, delivery: 'draft' };
      return this.send(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException(`${input.email} already has an open invitation.`);
      throw error;
    }
  }

  /** Issues a token for a draft or pending invitation, emails it when SMTP is configured, and notifies existing users. */
  async send(row: InvitationRow): Promise<SentInvitation> {
    const token = randomBytes(32).toString('base64url');
    const { rows } = await this.db.query<InvitationRow>(
      `update invitations set status = 'pending', token_hash = $2, expires_at = now() + interval '14 days' where id = $1 returning *`,
      [row.id, digest(token)],
    );
    const invitation = rows[0];
    const origin = process.env.AUTH_WEB_ORIGIN ? new URL(process.env.AUTH_WEB_ORIGIN).origin : '';
    const inviteLink = `${origin}/invitations#token=${token}`;
    const context = await this.db.query<{ org: string; project: string | null }>(
      'select o.name as org, p.name as project from organizations o left join projects p on p.id = $2 where o.id = $1',
      [invitation.organization_id, invitation.project_id],
    );
    const target = context.rows[0]?.project ? `${context.rows[0].project} (${context.rows[0].org})` : context.rows[0]?.org ?? 'ChainOps';
    let delivery: SentInvitation['delivery'] = 'link';
    if (process.env.AUTH_SMTP_URL && process.env.AUTH_EMAIL_FROM) {
      try {
        await nodemailer.createTransport(process.env.AUTH_SMTP_URL).sendMail({
          from: process.env.AUTH_EMAIL_FROM, to: invitation.email, subject: `You're invited to ${target} on ChainOps`,
          text: `You have been invited to ${target} as ${invitation.role}. Accept within 14 days: ${inviteLink}`,
        });
        delivery = 'email';
      } catch {
        delivery = 'link';
      }
    }
    // Existing users also see the invitation in ChainOps (no token in the notification).
    const user = await this.db.query<{ id: string }>('select id from users where email = $1', [invitation.email]);
    if (user.rows[0]) {
      await this.notifications.notify([user.rows[0].id], {
        type: 'invitation', title: 'Invitation received', body: `You were invited to ${target} as ${invitation.role}.`,
        organizationId: invitation.organization_id, projectId: invitation.project_id, link: '/invitations', linkLabel: 'View invitation',
        context: target, dedupeKey: `invitation:${invitation.id}`,
      });
    }
    return { invitation: presentInvitation(invitation), inviteLink, delivery };
  }

  async revoke(id: string, scope: { organizationId: string; projectId?: string }) {
    const { rowCount } = await this.db.query(
      `update invitations set status = 'revoked' where id = $1 and organization_id = $2 and ($3::uuid is null or project_id = $3) and status in ('draft', 'pending')`,
      [id, scope.organizationId, scope.projectId ?? null],
    );
    if (!rowCount) throw new NotFoundException('Open invitation not found');
    return { ok: true };
  }

  private async userEmail(userId: string): Promise<string> {
    const { rows } = await this.db.query<{ email: string; verified: boolean }>('select email, email_verified_at is not null as verified from users where id = $1', [userId]);
    if (!rows[0]) throw new NotFoundException('User not found');
    if (!rows[0].verified) throw new ForbiddenException('Verify your email before accepting invitations');
    return rows[0].email;
  }

  /** Pending invitations addressed to the signed-in user's email. */
  async mine(userId: string) {
    const email = await this.userEmail(userId);
    const { rows } = await this.db.query<InvitationRow & { organization_name: string; project_name: string | null; inviter: string | null }>(
      `select i.*, o.name as organization_name, p.name as project_name, u.full_name as inviter
         from invitations i join organizations o on o.id = i.organization_id
         left join projects p on p.id = i.project_id left join users u on u.id = i.invited_by
        where i.email = $1 and i.status = 'pending' and i.expires_at > now() order by i.created_at desc`,
      [email],
    );
    return rows.map((row) => ({ ...presentInvitation(row), organizationName: row.organization_name, projectName: row.project_name, invitedBy: row.inviter }));
  }

  /** Resolves an emailed token to the invitation, only for the invited user. */
  async byToken(userId: string, token: string) {
    if (!/^[\w-]{43}$/.test(token)) throw new BadRequestException('Invalid invitation link');
    const email = await this.userEmail(userId);
    const { rows } = await this.db.query<InvitationRow>('select * from invitations where token_hash = $1', [digest(token)]);
    if (!rows[0] || rows[0].status !== 'pending' || rows[0].expires_at.getTime() < Date.now()) throw new NotFoundException('This invitation is invalid, expired or already used.');
    if (rows[0].email !== email) throw new ForbiddenException(`This invitation was sent to a different email address than ${email}.`);
    return (await this.mine(userId)).find((item) => item.id === rows[0].id) ?? null;
  }

  async accept(userId: string, id: string) {
    const email = await this.userEmail(userId);
    const accepted = await this.db.transaction(async (client: pg.PoolClient) => {
      const { rows } = await client.query<InvitationRow>("select * from invitations where id = $1 and status = 'pending' and expires_at > now() for update", [id]);
      const invitation = rows[0];
      if (!invitation || invitation.email !== email) return null;
      // Project invitations also grant organization access (as Viewer) so project modules work.
      await client.query(
        'insert into organization_members (organization_id, user_id, role) values ($1, $2, $3) on conflict (organization_id, user_id) do nothing',
        [invitation.organization_id, userId, invitation.project_id ? 'viewer' : invitation.role],
      );
      if (invitation.project_id) {
        await client.query('insert into project_members (project_id, user_id, role) values ($1, $2, $3) on conflict (project_id, user_id) do update set role = excluded.role', [invitation.project_id, userId, invitation.role]);
      }
      await client.query("update invitations set status = 'accepted', accepted_at = now(), token_hash = null where id = $1", [id]);
      return invitation;
    });
    if (!accepted) throw new NotFoundException('This invitation is invalid, expired, already used, or addressed to someone else.');
    if (accepted.invited_by) {
      const who = await this.db.query<{ full_name: string }>('select full_name from users where id = $1', [userId]);
      await this.notifications.notify([accepted.invited_by], {
        type: 'member_joined', title: 'Invitation accepted', body: `${who.rows[0]?.full_name ?? email} joined as ${accepted.role}.`,
        organizationId: accepted.organization_id, projectId: accepted.project_id,
        link: accepted.project_id ? `/projects/${accepted.project_id}/team` : '/organization/people', linkLabel: 'View team',
        dedupeKey: `invitation:${accepted.id}:accepted`,
      });
    }
    return { organizationId: accepted.organization_id, projectId: accepted.project_id, role: accepted.role };
  }
}
