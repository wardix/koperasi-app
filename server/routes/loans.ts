import { Hono } from 'hono'
import db from '../db'
import type { LoanPaymentRow, LoanRow } from '../db/entities'
import { loanSchema, loanStatusSchema, paymentSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  createLoan,
  deleteLoan,
  enrichLoanForList,
  getBungaRatePercent,
  recordLoanPayment,
  updateLoanStatus,
} from '../services/loanService'
import { mapServiceError, requireRouteParam } from '../lib/serviceResponse'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'

const loans = new Hono()

loans.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  const includeArchived = c.req.query('includeArchived') === 'true'

  const whereClause = includeArchived ? '' : 'WHERE l.deletedAt IS NULL'

  const rows = await db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    ${whereClause}
    GROUP BY l.id
    ORDER BY l.id DESC
    LIMIT ? OFFSET ?
  `).all<LoanRow & { paidAmount?: number }>(limit, offset)

  const bungaRate = await getBungaRatePercent(db)
  const mappedLoans = rows.map((loan) => enrichLoanForList(loan, bungaRate))
  const totalRes = await db.query(`SELECT COUNT(*) as count FROM loans l ${whereClause}`).get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total: totalRes?.count ?? 0,
      page,
      limit
    }
  })
})

loans.post('/', requirePermission('create:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const { id } = await createLoan(db, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'create_loan',
      entity: 'loans',
      entityId: id,
      after: {
        memberId: parsed.data.memberId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        tenor: parsed.data.tenor,
        purpose: parsed.data.purpose,
        status: parsed.data.status,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.put('/:id/status', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanStatusSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const { status } = parsed.data
    const { before } = await updateLoanStatus(db, id, status)

    const action = status === 'Disetujui' ? 'approve_loan' : 'reject_loan'
    await audit(db, {
      actor: getActor(c),
      action,
      entity: 'loans',
      entityId: id,
      before: before ? { status: before.status } : undefined,
      after: { status },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Loan status updated' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.get('/payments', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT * FROM (
      SELECT
        'pencairan' as "type",
        l.id || '-disburse' as "id",
        l.id as "loanId",
        l.amount as "amount",
        l.createdAt as "paymentDate",
        'Transfer' as "method",
        l.name as "borrowerName"
      FROM loans l
      WHERE l.status IN ('Disetujui', 'Lunas', 'Macet')

      UNION ALL

      SELECT
        'angsuran' as "type",
        p.id as "id",
        p.loanId as "loanId",
        p.amount as "amount",
        p.paymentDate as "paymentDate",
        p.method as "method",
        l.name as "borrowerName"
      FROM loan_payments p
      LEFT JOIN loans l ON p.loanId = l.id
    ) combined
    ORDER BY "paymentDate" DESC
    LIMIT ? OFFSET ?
  `).all<LoanPaymentRow>(limit, offset)

  const totalRes = await db.query(`
    SELECT (
      (SELECT COUNT(*) FROM loans WHERE status IN ('Disetujui', 'Lunas', 'Macet')) +
      (SELECT COUNT(*) FROM loan_payments)
    ) as count
  `).get<{ count: number }>()

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

loans.get('/:id/payments', requirePermission('read:loans'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const payments = await db.query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC").all(id)
    return c.json({ success: true, data: payments })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.post('/:id/payments', requirePermission('create:payments'), async (c) => {
  const body = await c.req.json()
  const parsed = paymentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const loanId = requireRouteParam(c, 'id')
    const { id } = await recordLoanPayment(db, loanId, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'create_payment',
      entity: 'loan_payments',
      entityId: id,
      after: { loanId, amount: parsed.data.amount, method: parsed.data.method },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.delete('/:id', requirePermission('delete:loans'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    await deleteLoan(db, id)

    await audit(db, {
      actor: getActor(c),
      action: 'archive_loan',
      entity: 'loans',
      entityId: id,
      after: { deletedAt: new Date().toISOString() },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Loan archived successfully' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

export default loans