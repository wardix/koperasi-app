import { Hono } from 'hono'
import db from '../db'
import { loanSchema, loanStatusSchema, paymentSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { calculateLoanInterest } from '../services/loanService'
import { clearStatsCache } from './stats'

const loans = new Hono()

loans.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '0');

  const rows = await db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount 
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    GROUP BY l.id
    ORDER BY l.id DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]
  
  const mappedLoans = rows.map(loan => {
    const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);
    
    return {
      ...loan,
      interestAmount,
      totalAmount
    }
  });

  const totalRes = await db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total: totalRes.count,
      page,
      limit
    }
  })
})

loans.post('/', requirePermission('create:loans'), async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loanSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { memberId, name, amount, tenor, purpose, status } = parsed.data
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    const insert = await db.prepare(`
      INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    await insert.run(id, memberId, name, amount, tenor, purpose, status, createdAt)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

loans.put('/:id/status', requirePermission('approve:loans'), async (c) => {
  try {
    const id = c.req.param('id')
    console.log("Hono PUT /api/loans/:id/status called with id:", id)
    const body = await c.req.json()
    console.log("Request body:", body)
    const parsed = loanStatusSchema.safeParse(body)

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.format())
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { status } = parsed.data
    console.log("Status to update:", status)

    const stmt = await db.prepare("UPDATE loans SET status = ? WHERE id = ?")
    await stmt.run(status, id)
    console.log("Database update executed successfully")
    clearStatsCache()
    return c.json({ success: true, message: 'Loan status updated' })
  } catch (error) {
    throw error
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
  `).all(limit, offset) as any[]

  const totalRes = await db.query(`
    SELECT (
      (SELECT COUNT(*) FROM loans WHERE status IN ('Disetujui', 'Lunas', 'Macet')) +
      (SELECT COUNT(*) FROM loan_payments)
    ) as count
  `).get() as { count: number }

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

loans.get('/:id/payments', requirePermission('read:loans'), async (c) => {
  const id = c.req.param('id')
  const payments = await db.query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC").all(id)
  return c.json({ success: true, data: payments })
})

loans.post('/:id/payments', requirePermission('create:payments'), async (c) => {
  try {
    const loanId = c.req.param('id')
    const body = await c.req.json()
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { amount, method } = parsed.data
    
    const loan = await db.query("SELECT amount, tenor FROM loans WHERE id = ?").get(loanId) as { amount: number, tenor: string } | null;
    if (!loan) return c.json({ success: false, message: 'Loan not found' }, 404);

    const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
    const bungaRate = parseFloat(bungaSetting?.value || '0');
    const { totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);
    
    const paid = (await db.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get(loanId) as any).paid || 0;
    
    if (paid + amount > totalAmount) {
      return c.json({ success: false, message: 'Total pembayaran melebihi jumlah pinjaman' }, 400);
    }
    
    const id = crypto.randomUUID()
    const paymentDate = new Date().toISOString()

    const stmt = await db.prepare(`
      INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
      VALUES (?, ?, ?, ?, ?)
    `)
    await stmt.run(id, loanId, amount, paymentDate, method)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

loans.delete('/:id', requirePermission('delete:loans'), async (c) => {
  try {
    const id = c.req.param('id')
    const loan = await db.query("SELECT id FROM loans WHERE id = ?").get(id)
    if (!loan) {
      return c.json({ success: false, message: 'Loan not found' }, 404)
    }
    const stmt = await db.prepare("DELETE FROM loans WHERE id = ?")
    await stmt.run(id)
    clearStatsCache()
    return c.json({ success: true, message: 'Loan deleted successfully' })
  } catch (error) {
    throw error
  }
})

export default loans
