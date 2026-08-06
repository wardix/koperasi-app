import { Hono } from 'hono'
import db from '../db'
import type { LoanPaymentRow, LoanRow } from '../db/entities'
import {
  loanDisbursementDateSchema,
  loanSchema,
  loanScheduleRegenerateSchema,
  loanScheduleReplaceSchema,
  loanStatusSchema,
  paymentSchema,
  paymentUpdateSchema,
} from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  createLoan,
  deleteLoan,
  deleteLoanPayment,
  enrichLoanForList,
  getBungaRatePercent,
  getLoanSchedule,
  recordLoanPayment,
  regenerateLoanInstallmentSchedule,
  replaceLoanInstallmentSchedule,
  updateLoanDisbursementDate,
  updateLoanPayment,
  updateLoanStatus,
  batchImportLoans,
} from '../services/loanService'
import { mapServiceError, requireRouteParam } from '../lib/serviceResponse'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'
import { batchLoanImportSchema } from '../schemas'

const loans = new Hono()

loans.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  const includeArchived = c.req.query('includeArchived') === 'true'

  const whereClause = includeArchived ? '' : 'WHERE l.deletedAt IS NULL'

  const rows = await db.query(`
    SELECT l.*, COALESCE(m.name, l.name) as name, COALESCE(SUM(p.amount), 0) as paidAmount
    FROM loans l
    LEFT JOIN members m ON m.id = l.memberId
    LEFT JOIN loan_payments p ON l.id = p.loanId
    ${whereClause}
    GROUP BY l.id, m.name
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
    const { status, approvedDate, interestRate } = parsed.data
    const { before } = await updateLoanStatus(db, id, status, { approvedDate, interestRate })

    const action = status === 'Disetujui' ? 'approve_loan' : 'reject_loan'
    await audit(db, {
      actor: getActor(c),
      action,
      entity: 'loans',
      entityId: id,
      before: before ? { status: before.status } : undefined,
      after: {
        status,
        approvedDate: approvedDate ?? null,
        interestRate: interestRate ?? null,
      },
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

loans.put('/:id/disbursement-date', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanDisbursementDateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const { before, after } = await updateLoanDisbursementDate(db, id, parsed.data.disbursementDate)

    await audit(db, {
      actor: getActor(c),
      action: 'update_loan_disbursement',
      entity: 'loans',
      entityId: id,
      before,
      after,
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Tanggal pencairan diperbarui', data: after })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.get('/payments', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  // Soft-deleted loans (deletedAt set) must not appear as pencairan / angsuran ledger rows.
  // Prefer live members.name so renames show up even if loans.name snapshot is stale.
  const rows = await db.query(`
    SELECT * FROM (
      SELECT
        'pencairan' as "type",
        l.id || '-disburse' as "id",
        l.id as "loanId",
        l.amount as "amount",
        COALESCE(l.approvedAt::text, l.createdAt::text) as "paymentDate",
        'Transfer' as "method",
        COALESCE(m.name, l.name) as "borrowerName"
      FROM loans l
      LEFT JOIN members m ON m.id = l.memberId
      WHERE l.status IN ('Disetujui', 'Lunas', 'Macet')
        AND l.deletedAt IS NULL

      UNION ALL

      SELECT
        'angsuran' as "type",
        p.id as "id",
        p.loanId as "loanId",
        p.amount as "amount",
        p.paymentDate as "paymentDate",
        p.method as "method",
        COALESCE(m.name, l.name) as "borrowerName"
      FROM loan_payments p
      INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
      LEFT JOIN members m ON m.id = l.memberId
    ) combined
    ORDER BY "paymentDate" DESC
    LIMIT ? OFFSET ?
  `).all<LoanPaymentRow>(limit, offset)

  const totalRes = await db.query(`
    SELECT (
      (SELECT COUNT(*) FROM loans WHERE status IN ('Disetujui', 'Lunas', 'Macet') AND deletedAt IS NULL) +
      (SELECT COUNT(*) FROM loan_payments p
       INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL)
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

loans.get('/:id/schedule', requirePermission('read:loans'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const schedule = await getLoanSchedule(db, id)
    return c.json({ success: true, data: schedule })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.post('/:id/schedule/regenerate', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanScheduleRegenerateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const result = await regenerateLoanInstallmentSchedule(db, id, {
      interestRate: parsed.data.interestRate,
    })

    await audit(db, {
      actor: getActor(c),
      action: 'regenerate_loan_schedule',
      entity: 'loans',
      entityId: id,
      after: {
        scheduleRegenerated: true,
        interestRate: result.interestRate,
        monthlyPayment: result.monthlyPayment,
        totalAmount: result.totalAmount,
        rows: result.rows,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({
      success: true,
      message: 'Jadwal angsuran di-generate ulang',
      data: result,
    })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.put('/:id/schedule', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = loanScheduleReplaceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const result = await replaceLoanInstallmentSchedule(db, id, parsed.data.rows)

    await audit(db, {
      actor: getActor(c),
      action: 'replace_loan_schedule',
      entity: 'loans',
      entityId: id,
      after: {
        scheduleManualReplace: true,
        rows: result.rows,
        totalAmount: result.totalAmount,
        interestAmount: result.interestAmount,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({
      success: true,
      message: 'Jadwal angsuran disimpan',
      data: result,
    })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
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

loans.put('/:id/payments/:paymentId', requirePermission('create:payments'), async (c) => {
  const body = await c.req.json()
  const parsed = paymentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const loanId = requireRouteParam(c, 'id')
    const paymentId = requireRouteParam(c, 'paymentId')
    const { before, after } = await updateLoanPayment(db, loanId, paymentId, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'update_payment',
      entity: 'loan_payments',
      entityId: paymentId,
      before: {
        amount: before.amount,
        paymentDate: before.paymentDate,
        method: before.method,
      },
      after: {
        amount: after.amount,
        paymentDate: after.paymentDate,
        method: after.method,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Payment updated successfully', data: after })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

loans.delete('/:id/payments/:paymentId', requirePermission('create:payments'), async (c) => {
  try {
    const loanId = requireRouteParam(c, 'id')
    const paymentId = requireRouteParam(c, 'paymentId')
    const { before } = await deleteLoanPayment(db, loanId, paymentId)

    await audit(db, {
      actor: getActor(c),
      action: 'delete_payment',
      entity: 'loan_payments',
      entityId: paymentId,
      before: {
        loanId: before.loanId,
        amount: before.amount,
        paymentDate: before.paymentDate,
        method: before.method,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Payment deleted successfully' })
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

// ---------------------------------------------------------------------------
// CSV Template Download
// ---------------------------------------------------------------------------

loans.get('/template-csv', requirePermission('create:loans'), async (c) => {
  const today = new Date().toISOString().split('T')[0]
  const lines = [
    'nik,nama_pinjaman,jumlah,tenor,tujuan,tanggal_pinjaman,bunga',
    `3171012345670001,Pinjaman Modal Usaha,5000000,12,Modal usaha warung,${today},`,
    `3171012345670002,Pinjaman Konsumtif,3000000,6,Kebutuhan rumah tangga,${today},`,
  ]
  const csvText = '\uFEFF' + lines.join('\r\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="Template_Import_Pinjaman_${today}.csv"`)
  return c.text(csvText)
})

// ---------------------------------------------------------------------------
// Batch Import Loans
// ---------------------------------------------------------------------------

loans.post('/batch-import', requirePermission('create:loans'), async (c) => {
  const body = await c.req.json()
  const parsed = batchLoanImportSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  const result = await batchImportLoans(db, parsed.data.items)

  await audit(db, {
    actor: getActor(c),
    action: 'create_loan',
    entity: 'loans',
    after: { batchImportCount: result.processedCount, failedCount: result.failedCount },
    ip: getClientIp(c),
  })

  clearStatsCache()

  return c.json({
    success: true,
    message: `Berhasil mengimpor ${result.processedCount} pinjaman${result.failedCount > 0 ? `, ${result.failedCount} gagal` : ''}`,
    data: result,
  })
})

export default loans