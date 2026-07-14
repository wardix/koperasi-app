import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { calculateLoanInterest } from '../services/loanService'

const npl = new Hono()

npl.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '0');

  // Get all active loans with their DPD (Days Past Due) based on schedules
  const rows = await db.query(`
    SELECT l.*,
           COALESCE(SUM(p.amount), 0) as "paidAmount",
           (SELECT MIN(ls.dueDate) FROM loan_schedules ls WHERE ls.loanId = l.id AND ls.status != 'Paid' AND ls.dueDate < CURRENT_DATE) as oldestOverdueDate
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    WHERE l.status IN ('Disetujui', 'Macet')
    GROUP BY l.id
    ORDER BY COALESCE((SELECT MIN(ls.dueDate) FROM loan_schedules ls WHERE ls.loanId = l.id AND ls.status != 'Paid' AND ls.dueDate < CURRENT_DATE)::text, l.createdAt) DESC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]

  const mappedLoans = rows.map(loan => {
    // Calculate DPD based on oldest overdue schedule
    let dpd = 0;
    if (loan.oldestOverdueDate) {
      const oldestDueDate = new Date(loan.oldestOverdueDate);
      const today = new Date();
      dpd = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Use snapshot values for approved loans (historical consistency)
    let totalAmount: number;
    if (loan.approvedAt && loan.totalAmount !== null) {
      totalAmount = Number(loan.totalAmount);
    } else {
      ({ totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate));
    }

    const remainingAmount = Math.max(0, Number(totalAmount) - Number(loan.paidAmount || 0));

    return {
      ...loan,
      interestAmount: Number(loan.interestAmount || 0),
      totalAmount: Number(totalAmount),
      remainingAmount,
      dpd, // Days Past Due
      agingBucket: dpd >= 90 ? '90+' : dpd >= 60 ? '60-90' : dpd >= 30 ? '30-60' : 'Current'
    }
  })

  const totalRes = await db.query("SELECT COUNT(*) as count FROM loans WHERE status IN ('Disetujui', 'Macet')").get() as { count: number }

  // NPL calculation based on actual DPD (not just manual status)
  const [activeLoansRes, badLoansByStatusRes, badLoansByDPDRes] = await Promise.all([
    db.query("SELECT SUM(amount) as s FROM loans WHERE status IN ('Disetujui', 'Macet')").get() as Promise<{ s: number | null }>,
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet'").get() as Promise<{ s: number | null }>,
    // Loans with DPD >= 90 are considered NPL regardless of manual status
    db.query(`
      SELECT SUM(l.amount) as s
      FROM loans l
      JOIN loan_schedules ls ON l.id = ls.loanId
      WHERE ls.status != 'Paid' AND ls.dueDate < CURRENT_DATE - INTERVAL '90 days'
      GROUP BY l.id
    `).all() as Promise<{ s: number | null }[]>
  ])

  // Calculate total NPL by DPD (loans with any installment overdue > 90 days)
  const nplLoansByDPD = await db.query(`
    SELECT l.id, l.amount
    FROM loans l
    WHERE l.status IN ('Disetujui', 'Macet')
    AND EXISTS (
      SELECT 1 FROM loan_schedules ls
      WHERE ls.loanId = l.id
      AND ls.status != 'Paid'
      AND ls.dueDate < CURRENT_DATE - INTERVAL '90 days'
    )
  `).all() as any[];

  const totalNPLByDPD = nplLoansByDPD.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

  const totalActivePrincipal = activeLoansRes?.s || 0
  const totalBadPrincipalByStatus = badLoansByStatusRes?.s || 0
  const totalNPLByDPDNum = totalNPLByDPD; // Already a number from reduce

  const nplRatioByStatus = totalActivePrincipal > 0 ? (totalBadPrincipalByStatus / totalActivePrincipal) * 100 : 0;
  const nplRatioByDPD = totalActivePrincipal > 0 ? (totalNPLByDPDNum / totalActivePrincipal) * 100 : 0;

  // Count accounts by aging bucket
  const agingBuckets = await db.query(`
    SELECT
      CASE
        WHEN oldestDueDate IS NULL OR oldestDueDate >= CURRENT_DATE THEN 'Current'
        WHEN oldestDueDate >= CURRENT_DATE - INTERVAL '30 days' THEN '30-60'
        WHEN oldestDueDate >= CURRENT_DATE - INTERVAL '60 days' THEN '60-90'
        ELSE '90+'
      END as bucket,
      COUNT(*) as count
    FROM (
      SELECT l.id,
             (SELECT MIN(ls.dueDate) FROM loan_schedules ls WHERE ls.loanId = l.id AND ls.status != 'Paid') as oldestDueDate
      FROM loans l
      WHERE l.status IN ('Disetujui', 'Macet')
    ) sub
    GROUP BY 1
  `).all() as any[];

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total: totalRes.count,
      page,
      limit,
      summary: {
        totalActivePrincipal,
        totalBadPrincipal: totalBadPrincipalByStatus,
        totalBadPrincipalByStatus,
        totalNPLByDPD: totalNPLByDPDNum,
        nplRatio: nplRatioByStatus,
        nplRatioByStatus,
        nplRatioByDPD,
        agingBuckets: Object.fromEntries(agingBuckets.map(b => [b.bucket, Number(b.count || 0)])),
        badAccountsCount: nplLoansByDPD.length
      }
    }
  })
})

export default npl
