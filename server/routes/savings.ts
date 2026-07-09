import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'

const savings = new Hono()

savings.get('/transactions', requirePermission('read:members'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT t.*, m.name as memberName 
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
