/** PostgreSQL row shapes for the M4 interim governance resources. */
export interface SecurityPolicyRow {
  id: string;
  project_id: string;
  name: string;
  block_critical: boolean;
  block_high: boolean;
  require_approval: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Future decision states require a later schema and authorization change. */
export const APPROVAL_REQUEST_PENDING = 'PENDING' as const;
export type ApprovalRequestStatus = typeof APPROVAL_REQUEST_PENDING;

export interface ApprovalRequestRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  requested_by_id: string;
  status: ApprovalRequestStatus;
  created_at: Date;
  updated_at: Date;
}
