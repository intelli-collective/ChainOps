import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export type NotificationType = 'pipeline_failed' | 'pipeline_passed' | 'invitation' | 'member_joined' | 'approval' | 'deployment' | 'alert' | 'policy' | 'platform';

export interface NotificationEvent {
  type: NotificationType;
  title: string;
  body: string;
  organizationId?: string | null;
  projectId?: string | null;
  link?: string | null;
  linkLabel?: string | null;
  context?: string | null;
  // Identity of the domain event, e.g. "pipeline-run:<id>:finished". Repeated delivery is ignored.
  dedupeKey: string;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  link_label: string | null;
  context: string | null;
  project_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

/**
 * Shared notification service. Modules (M1–M4) report domain events here; delivery to
 * users is separate from detecting the event, and the same event never notifies twice.
 */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async notify(userIds: string[], event: NotificationEvent): Promise<void> {
    for (const userId of new Set(userIds)) {
      await this.db.query(
        `insert into notifications (user_id, organization_id, project_id, type, title, body, link, link_label, context, dedupe_key)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id, dedupe_key) do nothing`,
        [userId, event.organizationId ?? null, event.projectId ?? null, event.type, event.title.slice(0, 160), event.body.slice(0, 500),
          event.link ?? null, event.linkLabel ?? null, event.context ?? null, event.dedupeKey.slice(0, 200)],
      );
    }
  }

  async list(userId: string, options: { unreadOnly: boolean; limit: number }) {
    const { rows } = await this.db.query<NotificationRow>(
      `select id, type, title, body, link, link_label, context, project_id, read_at, created_at
         from notifications where user_id = $1 ${options.unreadOnly ? 'and read_at is null' : ''}
        order by created_at desc limit $2`,
      [userId, options.limit],
    );
    const unread = await this.db.query<{ n: number }>('select count(*)::int n from notifications where user_id = $1 and read_at is null', [userId]);
    return {
      unreadCount: unread.rows[0].n,
      items: rows.map((row) => ({
        id: row.id, type: row.type, title: row.title, body: row.body, link: row.link, linkLabel: row.link_label,
        context: row.context, projectId: row.project_id, read: row.read_at !== null, createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async markRead(userId: string, id: string) {
    const { rowCount } = await this.db.query('update notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2', [id, userId]);
    if (!rowCount) throw new NotFoundException('Notification not found');
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const { rowCount } = await this.db.query('update notifications set read_at = now() where user_id = $1 and read_at is null', [userId]);
    return { updated: rowCount ?? 0 };
  }
}
