import { Hono } from 'hono'
import db from '../db'
import type { AuditLogRow, AuditActionCount } from '../db/entities'
import { requirePermission } from '../middleware'

const auditRouter = new Hono()

/**
 * GET /api/v1/audit-logs — List audit log entries with filters.
 * Requires manage:users permission (superadmin only).
 */
auditRouter.get('/', requirePermission('manage:users'), async (c) => {
  const actor = c.req.query('actor')
  const action = c.req.query('action')
  const entity = c.req.query('entity')
  const entityId = c.req.query('entityId')
  const from = c.req.query('from')   // ISO date string
  const to = c.req.query('to')        // ISO date string
  const limitRaw = c.req.query('limit') || '50'
  const offsetRaw = c.req.query('offset') || '0'

  const limit = Math.min(parseInt(limitRaw, 10), 200)
  const offset = parseInt(offsetRaw, 10)

  // Build WHERE clause dynamically based on provided filters
  const conditions: string[] = ['1=1']
  const params: unknown[] = []

  if (actor) {
    conditions.push('actor = ?')
    params.push(actor)
  }
  if (action) {
    conditions.push('action = ?')
    params.push(action)
  }
  if (entity) {
    conditions.push('entity = ?')
    params.push(entity)
  }
  if (entityId) {
    conditions.push('entity_id = ?')
    params.push(entityId)
  }
  if (from) {
    conditions.push('created_at >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('created_at <= ?')
    params.push(to)
  }

  const whereClause = conditions.join(' AND ')

  // Query audit logs with filters, ordered by most recent first
  const rows = await db.query(
    `SELECT * FROM audit_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all<AuditLogRow>(...params, limit, offset)

  // Parse JSONB fields back to objects for API response
  for (const row of rows) {
    if (row.before) {
      try {
        row.before = typeof row.before === 'string' ? JSON.parse(row.before) : row.before
      } catch {
        row.before = {} // Fallback for malformed JSON
      }
    }
    if (row.after) {
      try {
        row.after = typeof row.after === 'string' ? JSON.parse(row.after) : row.after
      } catch {
        row.after = {} // Fallback for malformed JSON
      }
    }
  }

  return c.json({ success: true, data: rows })
})

/**
 * GET /api/v1/audit-logs/stats — Summary counts grouped by action.
 * Requires manage:users permission (superadmin only).
 */
auditRouter.get('/stats', requirePermission('manage:users'), async (c) => {
  const rows = await db.query(
    `SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC`
  ).all<AuditActionCount>()

  return c.json({ success: true, data: rows })
})

export default auditRouter
