import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { calculateLoanInterest } from '../services/loanService'

const npl = new Hono()

npl.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined
  const bungaRate = parseFloat(bungaSetting?.value || '0')

  const rows = await db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as "paidAmount" 
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    WHERE l.status = 'Macet'
    GROUP BY l.id
    ORDER BY l.amount DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]

  const mappedLoans = rows.map(loan => {
    const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate)
    const remainingAmount = Math.max(0, totalAmount - loan.paidAmount)
    return {
      ...loan,
      interestAmount,
      totalAmount,
      remainingAmount
    }
  })

  const totalRes = await db.query("SELECT COUNT(*) as count FROM loans WHERE status = 'Macet'").get() as { count: number }

  const [activeLoansRes, badLoansRes, totalBadAccountsRes] = await Promise.all([
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Disetujui'").get() as Promise<{ s: number | null }>,
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet'").get() as Promise<{ s: number | null }>,
    db.query("SELECT COUNT(*) as c FROM loans WHERE status = 'Macet'").get() as Promise<{ c: number }>
  ])

  const totalActivePrincipal = activeLoansRes?.s || 0
  const totalBadPrincipal = badLoansRes?.s || 0
  const totalActiveLoansPrincipal = totalActivePrincipal + totalBadPrincipal
  const nplRatio = totalActiveLoansPrincipal > 0 ? (totalBadPrincipal / totalActiveLoansPrincipal) * 100 : 0
  const badAccountsCount = totalBadAccountsRes?.c || 0

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total: totalRes.count,
      page,
      limit,
      summary: {
        totalBadPrincipal,
        totalActivePrincipal,
        nplRatio,
        badAccountsCount
      }
    }
  })
})

export default npl
