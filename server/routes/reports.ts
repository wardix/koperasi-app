import { Hono } from 'hono'
import db from '../db'
import type { ReportMembersStats, ReportLoansStats, InterestPaymentRow } from '../db/entities'
import { requirePermission } from '../middleware'
import { calculateLoanInterest } from '../services/loanService'

const reports = new Hono()

reports.get('/summary', requirePermission('read:reports'), async (c) => {
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
  `).get<ReportMembersStats>()

  const loanStats = await db.query(`
    SELECT 
      COUNT(*) as "totalLoansCount",
      SUM(amount) as "totalLoansAmount",
      SUM(CASE WHEN status = 'Disetujui' THEN amount ELSE 0 END) as "activeLoansAmount",
      SUM(CASE WHEN status = 'Macet' THEN amount ELSE 0 END) as "badLoansAmount",
      SUM(CASE WHEN status = 'Lunas' THEN amount ELSE 0 END) as "paidLoansAmount"
    FROM loans
  `).get<ReportLoansStats>()

  const loanPaymentsStats = await db.query(`
    SELECT SUM(amount) as "totalPaymentsReceived" FROM loan_payments
  `).get<{ totalPaymentsReceived: number | null }>()

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

reports.get('/monthly-interest', requirePermission('read:reports'), async (c) => {
  try {
    const year = c.req.query('year') || new Date().getFullYear().toString();
    const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get<{ value: string }>();
    const bungaRate = parseFloat(bungaSetting?.value || '18');

    const payments = await db.query(`
      SELECT lp.amount as paymentAmount, l.amount as principalAmount, l.tenor, lp.paymentDate
      FROM loan_payments lp
      JOIN loans l ON lp.loanId = l.id
      WHERE TO_CHAR(lp.paymentDate::timestamp, 'YYYY') = ?
    `).all<InterestPaymentRow>(year);

    // Initialize all 12 months
    const monthlyInterestMap: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      monthlyInterestMap[monthKey] = 0;
    }

    for (const p of payments) {
      const pAmt = Number(p.paymentAmount ?? 0);
      const princAmt = Number(p.principalAmount ?? 0);
      const { interestAmount, totalAmount } = calculateLoanInterest(princAmt, p.tenor ?? 0, bungaRate);
      const interestPaid = totalAmount > 0 ? Math.round(pAmt * (interestAmount / totalAmount)) : 0;
      
      const paymentDate = p.paymentDate;
      if (paymentDate) {
        const monthKey = paymentDate.substring(0, 7); // YYYY-MM
        if (monthlyInterestMap[monthKey] !== undefined) {
          monthlyInterestMap[monthKey] += interestPaid;
        }
      }
    }

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const data = Object.entries(monthlyInterestMap).map(([key, val]) => {
      const monthIndex = parseInt(key.split('-')[1]) - 1;
      return {
        monthKey: key,
        monthName: monthNames[monthIndex],
        interestIncome: val
      };
    }).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    return c.json({ success: true, data });
  } catch (error) {
    throw error
  }
})

export default reports
