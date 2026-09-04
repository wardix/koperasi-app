import type { Context } from 'hono';
import type { AppVariables, JwtPayload } from '../types/auth';

/**
 * Audit log helper for recording sensitive admin operations.
 * All mutations should call audit() after successful write to maintain an immutable trail.
 */

export type AuditAction =
  | 'create_admin'
  | 'update_admin'
  | 'delete_admin'
  | 'create_loan'
  | 'approve_loan'
  | 'reject_loan'
  | 'create_member'
  | 'update_member'
  | 'delete_member'
  | 'update_savings'
  | 'update_settings'
  | 'close_shu'
  | 'reopen_shu'
  | 'create_payment'
  | 'update_payment'
  | 'delete_payment'
  | 'update_loan_disbursement'
  | 'regenerate_loan_schedule'
  | 'replace_loan_schedule'
  | 'create_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'archive_loan'
  | 'archive_member'
  | 'create_account'
  | 'create_journal'
  | 'reverse_journal'
  | 'delete_journal'
  | 'disburse_ewa'
  | 'reject_ewa'
  | 'import_company_employees'
  | 'settle_ewa_payroll'
  | 'create_letter'
  | 'update_letter'
  | 'delete_letter'
  | 'approve_savings_withdrawal'
  | 'reject_savings_withdrawal';

export interface AuditRecord {
  actor: string;        // admin email who performed the action
  action: AuditAction;
  entity: string;       // table/entity name (e.g. "loans", "settings")
  entityId?: string | null;    // specific record id (NULL for bulk actions)
  before?: Record<string, unknown>;  // previous state snapshot
  after?: Record<string, unknown>;   // new state snapshot
  ip?: string;          // client IP from request headers
}

/** Known sensitive field names to redact from audit snapshots. */
const SENSITIVE_KEYS = ['password', 'newPassword', 'currentPassword', 'secret'];

function sanitize(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '***REDACTED***' : v;
  }
  return out;
}

interface AuditDb {
  run: (q: string, args?: unknown[]) => Promise<void>;
}

export async function audit(db: AuditDb, record: AuditRecord): Promise<void> {
  const cleanBefore = sanitize(record.before);
  const cleanAfter = sanitize(record.after);

  await db.run(
    `INSERT INTO audit_logs (id, actor, action, entity, entity_id, before, after, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      crypto.randomUUID(),
      record.actor,
      record.action,
      record.entity,
      record.entityId ?? null,
      cleanBefore ? JSON.stringify(cleanBefore) : null,
      cleanAfter ? JSON.stringify(cleanAfter) : null,
      record.ip ?? null,
    ]
  );
}

/** Extract JWT payload from Hono context (typed). */
export function getJwtPayload(c: Context<{ Variables: AppVariables }> | Context): JwtPayload | undefined {
  return c.get('jwtPayload') as JwtPayload | undefined;
}

/** Extract actor email from JWT payload stored on the Hono context. */
export function getActor(c: Context): string {
  return getJwtPayload(c)?.email || 'system';
}

/** Extract client IP from request headers (handles proxies). */
export function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}
