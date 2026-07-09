import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'

const reports = new Hono()

reports.get('/summary', requirePermission('read:stats'), async (c) => {
  const memberStats = await db.query(`
    SELECT 
      COUNT(*) as "totalMembers",
      SUM(CASE WHEN status = 'Aktif' THEN 1 ELSE 0 END) as "activeMembers",
      SUM(CASE WHEN status = 'Pasif' THEN 1 ELSE 0 END) as "passiveMembers",
      SUM(simpananPokok) as "totalPokok",
      SUM(simpananWajib) as "totalWajib",
      SUM(simpananSukarela) as "totalSukarela",
      SUM(totalSavings) as "totalSavings"
    FROM members
  `).get() as any

  const loanStats = await db.query(`
    SELECT 
      COUNT(*) as "totalLoansCount",
      SUM(amount) as "totalLoansAmount",
      SUM(CASE WHEN status = 'Disetujui' THEN amount ELSE 0 END) as "activeLoansAmount",
      SUM(CASE WHEN status = 'Macet' THEN amount ELSE 0 END) as "badLoansAmount",
      SUM(CASE WHEN status = 'Lunas' THEN amount ELSE 0 END) as "paidLoansAmount"
    FROM loans
  `).get() as any

  const loanPaymentsStats = await db.query(`
    SELECT SUM(amount) as "totalPaymentsReceived" FROM loan_payments
  `).get() as any

  return c.json({
    success: true,
    data: {
      members: {
        totalMembers: memberStats?.totalMembers || 0,
        activeMembers: memberStats?.activeMembers || 0,
        passiveMembers: memberStats?.passiveMembers || 0,
        totalPokok: memberStats?.totalPokok || 0,
        totalWajib: memberStats?.totalWajib || 0,
        totalSukarela: memberStats?.totalSukarela || 0,
        totalSavings: memberStats?.totalSavings || 0
      },
      loans: {
        totalLoansCount: loanStats?.totalLoansCount || 0,
        totalLoansAmount: loanStats?.totalLoansAmount || 0,
        activeLoansAmount: loanStats?.activeLoansAmount || 0,
        badLoansAmount: loanStats?.badLoansAmount || 0,
        paidLoansAmount: loanStats?.paidLoansAmount || 0,
        totalPaymentsReceived: loanPaymentsStats?.totalPaymentsReceived || 0
      },
      timestamp: new Date().toISOString()
    }
  })
})

export default reports
