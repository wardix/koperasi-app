import { Hono } from 'hono'
import db from '../db'
import { loanSchema, loanStatusSchema, paymentSchema } from '../schemas'
import { requireAdmin } from '../middleware'
import { parsePagination } from '../services/pagination'
import { calculateLoanInterest } from '../services/loanService'
import { clearStatsCache } from './stats'

const loans = new Hono()

loans.get('/', (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const bungaSetting = db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '0');

  const rows = db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount 
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    GROUP BY l.id
    ORDER BY l.rowid DESC 
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

  const totalRes = db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number }

  return c.json({
    data: mappedLoans,
    total: totalRes.count,
    page,
    limit
  })
})

loans.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loanSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { memberId, name, amount, tenor, purpose, status } = parsed.data
    const id = crypto.randomUUID()

    const insert = db.prepare(`
      INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    insert.run(id, memberId, name, amount, tenor, purpose, status)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

loans.put('/:id/status', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = loanStatusSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { status } = parsed.data

    db.prepare("UPDATE loans SET status = ? WHERE id = ?").run(status, id)
    clearStatsCache()
    return c.json({ success: true, message: 'Loan status updated' })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

loans.get('/:id/payments', (c) => {
  const id = c.req.param('id')
  const payments = db.query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC").all(id)
  return c.json(payments)
})

loans.post('/:id/payments', requireAdmin, async (c) => {
  try {
    const loanId = c.req.param('id')
    const body = await c.req.json()
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { amount, method } = parsed.data
    
    const loan = db.query("SELECT amount, tenor FROM loans WHERE id = ?").get(loanId) as { amount: number, tenor: string } | null;
    if (!loan) return c.json({ success: false, message: 'Loan not found' }, 404);

    const bungaSetting = db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
    const bungaRate = parseFloat(bungaSetting?.value || '0');
    const { totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);
    
    const paid = (db.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get(loanId) as any).paid || 0;
    
    if (paid + amount > totalAmount) {
      return c.json({ success: false, message: 'Total pembayaran melebihi jumlah pinjaman' }, 400);
    }
    
    const id = crypto.randomUUID()
    const paymentDate = new Date().toISOString()

    db.prepare(`
      INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, loanId, amount, paymentDate, method)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

export default loans
