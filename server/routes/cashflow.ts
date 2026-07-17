import { Hono } from 'hono'
import db from '../db'
import type { CashflowRow } from '../db/entities'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'

const cashflow = new Hono()

cashflow.get('/', requirePermission('read:cashflow'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const totalInflowRes = await db.query(`
    SELECT SUM(amount) as total FROM (
      SELECT t.amount FROM transactions t WHERE t.type LIKE 'setor_%'
      UNION ALL
      SELECT p.amount FROM loan_payments p
        INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
    ) as inflows
  `).get() as { total: number }

  const totalOutflowRes = await db.query(`
    SELECT SUM(amount) as total FROM (
      SELECT t.amount FROM transactions t WHERE t.type LIKE 'tarik_%'
      UNION ALL
      SELECT l.amount FROM loans l
        WHERE l.status IN ('Disetujui', 'Lunas') AND l.deletedAt IS NULL
    ) as outflows
  `).get() as { total: number }

  // Postgres SUM may arrive as string; coerce so JSON clients format correctly
  const totalInflow = Number(totalInflowRes?.total ?? 0) || 0
  const totalOutflow = Number(totalOutflowRes?.total ?? 0) || 0
  const netCash = totalInflow - totalOutflow

  const queryStr = `
    SELECT 
      'savings' as source,
      t.id,
      t.createdAt as "date",
      m.name as "partyName",
      t.type as description,
      t.amount,
      CASE WHEN t.type LIKE 'setor_%' THEN 'inflow' ELSE 'outflow' END as "flowType"
    FROM transactions t
    LEFT JOIN members m ON t.memberId = m.id

    UNION ALL

    SELECT 
      'loan_payment' as source,
      p.id,
      p.paymentDate as "date",
      l.name as "partyName",
      'Angsuran Pinjaman' as description,
      p.amount,
      'inflow' as "flowType"
    FROM loan_payments p
    INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL

    UNION ALL

    SELECT 
      'loan_disbursement' as source,
      l.id,
      COALESCE(l.approvedAt::text, l.createdAt::text, '2026-01-01T00:00:00.000Z') as "date",
      l.name as "partyName",
      'Pencairan Pinjaman' as description,
      l.amount,
      'outflow' as "flowType"
    FROM loans l
    WHERE l.status IN ('Disetujui', 'Lunas')
      AND l.deletedAt IS NULL

    ORDER BY "date" DESC
    LIMIT ? OFFSET ?
  `

  const rows = await db.query(queryStr).all<CashflowRow>(limit, offset)

  const countQuery = `
    SELECT COUNT(*) as count FROM (
      SELECT id FROM transactions
      UNION ALL
      SELECT p.id FROM loan_payments p
        INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
      UNION ALL
      SELECT id FROM loans WHERE status IN ('Disetujui', 'Lunas') AND deletedAt IS NULL
    ) as combined
  `
  const totalRes = await db.query(countQuery).get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: rows,
      total: totalRes?.count ?? 0,
      page,
      limit,
      summary: {
        totalInflow,
        totalOutflow,
        netCash
      }
    }
  })
})

export default cashflow
