import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { SAVINGS_TRANSACTION_TYPES } from '../schemas'

const savings = new Hono()

// Validate that transaction type is in the allowed enum
function isValidTransactionType(type: string): boolean {
  return SAVINGS_TRANSACTION_TYPES.includes(type as any)
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
  `).all(limit, offset) as any[]

  const totalRes = await db.query("SELECT COUNT(*) as count FROM transactions").get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: rows,
      total: totalRes.count,
      page,
      limit
    }
  })
})

export default savings
