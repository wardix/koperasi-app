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
    WHERE deletedAt IS NULL
  `).get<ReportMembersStats>()

  const loanStats = await db.query(`
    SELECT 
      COUNT(*) as "totalLoansCount",
      SUM(amount) as "totalLoansAmount",
      SUM(CASE WHEN status = 'Disetujui' THEN amount ELSE 0 END) as "activeLoansAmount",
      SUM(CASE WHEN status = 'Macet' THEN amount ELSE 0 END) as "badLoansAmount",
      SUM(CASE WHEN status = 'Lunas' THEN amount ELSE 0 END) as "paidLoansAmount"
    FROM loans
    WHERE deletedAt IS NULL
  `).get<ReportLoansStats>()

  const loanPaymentsStats = await db.query(`
    SELECT SUM(lp.amount) as "totalPaymentsReceived"
    FROM loan_payments lp
    JOIN loans l ON lp.loanId = l.id AND l.deletedAt IS NULL
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
      CAST(l.amount AS INT) as "principal", 
      CAST(COALESCE(l.totalAmount, l.amount) AS INT) as "totalAmount", 
      CAST(COALESCE(SUM(p.amount), 0) AS INT) as "paidAmount",
      CAST(COALESCE(l.totalAmount, l.amount) - COALESCE(SUM(p.amount), 0) AS INT) as "remainingAmount", 
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
    SELECT 
      name as "memberName", 
      CAST(simpananPokok AS INT) as "simpananPokok", 
      CAST(simpananWajib AS INT) as "simpananWajib", 
      CAST(simpananSukarela AS INT) as "simpananSukarela", 
      CAST(totalSavings AS INT) as "totalSavings"
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
      COALESCE(a_counter.code, 'other') as counter_code,
      COALESCE(a_counter.name, 'Lain-lain') as counter_name,
      COALESCE(a_counter.type, 'OTHER') as counter_type,
      COALESCE(je.reference_type, 'jurnal_umum') as reference_type,
      SUM(CASE WHEN jl.debit > 0 THEN jl_counter.credit ELSE jl_counter.debit END) as total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN journal_lines jl_counter ON jl.journal_entry_id = jl_counter.journal_entry_id AND jl.id != jl_counter.id
    LEFT JOIN accounts a_counter ON jl_counter.account_id = a_counter.id
    WHERE a.code IN ('11101', '11102') AND (a_counter.code NOT IN ('11101', '11102') OR a_counter.code IS NULL) ${dateFilterJe}
    GROUP BY category, counter_code, counter_name, counter_type, reference_type
    ORDER BY category, total DESC
  `;

  const getDetailLabel = (category: string, counterCode: string, counterName: string, refType: string) => {
    if (category === 'inflow') {
      switch (counterCode) {
        case '31101': return 'Penerimaan Simpanan Pokok Anggota';
        case '31102': return 'Penerimaan Simpanan Wajib Anggota';
        case '21101': return 'Penerimaan Simpanan Sukarela Anggota';
        case '11201': return 'Penerimaan Angsuran Pokok Pinjaman';
        case '41101': return 'Penerimaan Jasa / Bunga Pinjaman';
        case '41102': return 'Penerimaan Provisi & Administrasi Pinjaman';
        case '41103': return 'Penerimaan Biaya Layanan Gaji Awal (EWA)';
        case '11301': return 'Pelunasan Payroll Kasbon Gaji (EWA)';
        case '42101': return 'Penerimaan Jasa Giro / Bunga Bank';
        case '42102': return 'Penerimaan Pendapatan Denda';
        case '21201': return 'Penerimaan Kas Awal / Beban Yang Masih Harus Dibayar';
        default: return `Penerimaan: ${counterName}`;
      }
    } else {
      switch (counterCode) {
        case '11201': return 'Pencairan Penyaluran Pinjaman Anggota';
        case '21101': return 'Penarikan Simpanan Sukarela Anggota';
        case '11301': return 'Pencairan Kasbon Gaji Awal (EWA)';
        case '61101': return 'Pembayaran Beban Gaji & Tunjangan';
        case '61201': return 'Pembayaran Beban Operasional Kantor';
        case '61301': return 'Pembayaran Beban Pelaksanaan RAT';
        case '12101': return 'Pengeluaran Pembelian Peralatan Kantor';
        case '11401': return 'Pengeluaran Pembelian Perlengkapan Kantor';
        default: return `Pengeluaran: ${counterName}`;
      }
    }
  };

  const rows = await db.query(query).all(...params);
  const mapped = rows.map((r: any) => ({
    category: r.category,
    subcategory: r.counter_name || r.reference_type,
    accountCode: r.counter_code,
    accountName: r.counter_name,
    label: getDetailLabel(r.category, r.counter_code, r.counter_name, r.reference_type),
    total: Number(r.total || 0)
  }));
  return c.json({ success: true, data: mapped });
})
reports.get('/income-statement', requirePermission('read:reports'), async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  let dateFilterJe = '';
  const params: string[] = [];
  if (startDate && endDate) {
    dateFilterJe = `WHERE je.transaction_date >= ? AND je.transaction_date <= ?`;
    params.push(startDate, endDate);
  } else if (startDate) {
    dateFilterJe = `WHERE je.transaction_date >= ?`;
    params.push(startDate);
  } else if (endDate) {
    dateFilterJe = `WHERE je.transaction_date <= ?`;
    params.push(endDate);
  }

  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN (
      SELECT jl.* 
      FROM journal_lines jl 
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      ${dateFilterJe}
    ) jl ON a.id = jl.account_id
    WHERE a.type IN ('REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await db.query(query).all(...params);
  
  const revenues = rows.filter((r: any) => r.type === 'REVENUE').map((r: any) => ({ ...r, balance: Number(r.total_credit) - Number(r.total_debit) }));
  const expenses = rows.filter((r: any) => r.type === 'EXPENSE').map((r: any) => ({ ...r, balance: Number(r.total_debit) - Number(r.total_credit) }));
  
  const totalRevenue = revenues.reduce((sum, r) => sum + r.balance, 0);
  const totalExpense = expenses.reduce((sum, r) => sum + r.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  return c.json({ success: true, data: { revenues, expenses, totalRevenue, totalExpense, netIncome } });
})

reports.get('/balance-sheet', requirePermission('read:reports'), async (c) => {
  const endDate = c.req.query('endDate') || c.req.query('asOfDate');

  let dateFilterJe = '';
  const params: string[] = [];
  if (endDate) {
    dateFilterJe = `WHERE je.transaction_date <= ?`;
    params.push(endDate);
  }

  const query = `
    SELECT 
      a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN (
      SELECT jl.* 
      FROM journal_lines jl 
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      ${dateFilterJe}
    ) jl ON a.id = jl.account_id
    WHERE a.type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
  `;
  const rows = await db.query(query).all(...params);
  
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
