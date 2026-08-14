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

reports.get('/ar', requirePermission('read:reports'), async (c) => {
  const rows = await db.query(`
    SELECT 
      m.name as "memberName", 
      l.id as "loanId", 
      l.amount as "principal", 
      COALESCE(l.totalAmount, l.amount) as "totalAmount", 
      COALESCE(SUM(p.amount), 0) as "paidAmount",
      (COALESCE(l.totalAmount, l.amount) - COALESCE(SUM(p.amount), 0)) as "remainingAmount", 
      l.status
    FROM loans l
    JOIN members m ON l.memberId = m.id
    LEFT JOIN loan_payments p ON l.id = p.loanId
    WHERE l.status IN ('Disetujui', 'Macet') AND l.deletedAt IS NULL
    GROUP BY l.id, m.name
    ORDER BY "remainingAmount" DESC
  `).all();
  return c.json({ success: true, data: rows });
})

reports.get('/savings-member', requirePermission('read:reports'), async (c) => {
  const rows = await db.query(`
    SELECT name as "memberName", simpananPokok, simpananWajib, simpananSukarela, totalSavings
    FROM members
    WHERE deletedAt IS NULL
    ORDER BY name ASC
  `).all();
  return c.json({ success: true, data: rows });
})

reports.get('/cashflow-statement', requirePermission('read:reports'), async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');


  let dateFilterJe = '';
  const params: string[] = [];
  if (startDate && endDate) {
    dateFilterJe = `AND je.transaction_date >= ? AND je.transaction_date <= ?`;
    params.push(startDate, endDate);
  } else if (startDate) {
    dateFilterJe = `AND je.transaction_date >= ?`;
    params.push(startDate);
  } else if (endDate) {
    dateFilterJe = `AND je.transaction_date <= ?`;
    params.push(endDate);
  }

  const query = `
    SELECT 
      CASE WHEN jl.debit > 0 THEN 'inflow' ELSE 'outflow' END as category, 
      COALESCE(je.reference_type, 'jurnal_umum') as subcategory, 
      SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END) as total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102') ${dateFilterJe}
    GROUP BY category, subcategory
  `;

  const rows = await db.query(query).all(...params);
  const mapped = rows.map((r: any) => ({
    category: r.category,
    subcategory: r.subcategory,
    total: Number(r.total || 0)
  }));
  return c.json({ success: true, data: mapped });
})
reports.get('/income-statement', requirePermission('read:reports'), async (c) => {
  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.type IN ('REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await db.query(query).all();
  
  const revenues = rows.filter((r: any) => r.type === 'REVENUE').map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  const expenses = rows.filter((r: any) => r.type === 'EXPENSE').map((r: any) => ({ ...r, balance: Number(r.total_debit) - Number(r.total_credit) }));
  
  const totalRevenue = revenues.reduce((sum, r) => sum + r.balance, 0);
  const totalExpense = expenses.reduce((sum, r) => sum + r.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  return c.json({ success: true, data: { revenues, expenses, totalRevenue, totalExpense, netIncome } });
})

reports.get('/balance-sheet', requirePermission('read:reports'), async (c) => {
  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await db.query(query).all();
  
  const revenues = rows.filter((r: any) => r.type === 'REVENUE').map((r: any) => Number(r.total_credit) - Number(r.total_debit));
  const expenses = rows.filter((r: any) => r.type === 'EXPENSE').map((r: any) => Number(r.total_debit) - Number(r.total_credit));
  const netIncome = revenues.reduce((a, b) => a + b, 0) - expenses.reduce((a, b) => a + b, 0);

  const assets = rows.filter((r: any) => r.type === 'ASSET').map((r: any) => ({ ...r, balance: Number(r.total_debit) - Number(r.total_credit) }));
  const liabilities = rows.filter((r: any) => r.type === 'LIABILITY').map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  const equity = rows.filter((r: any) => r.type === 'EQUITY').map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  
  const shuTahunBerjalan = equity.find(e => e.code === '33102');
  if (shuTahunBerjalan) {
    shuTahunBerjalan.balance += netIncome;
  } else {
    equity.push({ code: '33102', name: 'SHU Tahun Berjalan', type: 'EQUITY', normal_balance: 'CREDIT', total_debit: 0, total_credit: netIncome, balance: netIncome });
  }

  const totalAssets = assets.reduce((sum, r) => sum + r.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, r) => sum + r.balance, 0);
  const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);

  return c.json({ success: true, data: { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity } });
})

export default reports
