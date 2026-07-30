import { Hono } from 'hono'
import db from '../db'
import type { TransactionRow } from '../db/entities'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { SAVINGS_TRANSACTION_TYPES, batchSavingsImportSchema } from '../schemas'
import { batchImportSavings } from '../services/savingsService'
import { audit, getActor, getClientIp } from '../lib/audit'
import { clearStatsCache } from './stats'

const savings = new Hono()

// Validate that transaction type is in the allowed enum
function isValidTransactionType(type: string): type is (typeof SAVINGS_TRANSACTION_TYPES)[number] {
  return (SAVINGS_TRANSACTION_TYPES as readonly string[]).includes(type)
}

savings.get('/transactions', requirePermission('read:members'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT t.*, m.name as "memberName" 
    FROM transactions t
    LEFT JOIN members m ON t.memberId = m.id
    ORDER BY t.createdAt DESC 
    LIMIT ? OFFSET ?
  `).all<TransactionRow>(limit, offset)

  const totalRes = await db.query("SELECT COUNT(*) as count FROM transactions").get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: rows,
      total: totalRes?.count ?? 0,
      page,
      limit
    }
  })
})

savings.post('/batch-import', requirePermission('update:savings'), async (c) => {
  const body = await c.req.json()
  const parsed = batchSavingsImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportSavings(db, parsed.data.items, getActor(c))

  await audit(db, {
    actor: getActor(c),
    action: 'update_savings',
    entity: 'members',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} data simpanan`,
    data: result,
  })
})

export default savings
