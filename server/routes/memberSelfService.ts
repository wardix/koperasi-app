import { Hono } from 'hono';
import db from '../db';
import type { JwtPayload } from '../types/auth';

const memberSelfService = new Hono();

// Middleware to ensure route is only accessed by a member
memberSelfService.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined;
  if (!payload || payload.role !== 'member') {
    return c.json({ success: false, message: 'Unauthorized, member access only' }, 401);
  }
  return next();
});

// Get member profile and savings summary
memberSelfService.get('/profile', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const member = await db.query(
    "SELECT id, name, role, status, joinDate, nik, phone, simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?"
  ).get(memberId);

  if (!member) {
    return c.json({ success: false, message: 'Member not found' }, 404);
  }

  return c.json({ success: true, data: member });
});

// Get savings mutations
memberSelfService.get('/savings/transactions', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const transactions = await db.query(
    "SELECT id, type, amount, balanceBefore, balanceAfter, createdAt, createdBy FROM transactions WHERE memberId = ? ORDER BY seq DESC"
  ).all(memberId);

  return c.json({ success: true, data: transactions });
});

// Get member loans (paidAmount is not a loans column — sum from loan_payments)
memberSelfService.get('/loans', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const loans = await db.query(
    `SELECT l.id, COALESCE(m.name, l.name) AS name, l.amount, l.tenor, l.purpose, l.status, l.createdAt,
            l.interestRate, l.monthlyPayment, l.interestAmount, l.totalAmount,
            l.approvedAt, l.totalInstallments, l.paidInstallments,
            COALESCE(SUM(p.amount), 0) AS paidAmount
     FROM loans l
     LEFT JOIN members m ON m.id = l.memberId
     LEFT JOIN loan_payments p ON l.id = p.loanId
     WHERE l.memberId = ? AND l.deletedAt IS NULL
     GROUP BY l.id, m.name
     ORDER BY l.createdAt DESC`
  ).all(memberId);

  return c.json({ success: true, data: loans });
});

// Get loan schedule for a specific loan
memberSelfService.get('/loans/:loanId/schedule', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;
  const loanId = c.req.param('loanId');

  // Verify the loan belongs to the member
  const loan = await db.query("SELECT id FROM loans WHERE id = ? AND memberId = ?").get(loanId, memberId);
  if (!loan) {
    return c.json({ success: false, message: 'Loan not found or unauthorized' }, 404);
  }

  const schedule = await db.query(
    "SELECT id, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status, lateFee, paidAt FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC"
  ).all(loanId);

  return c.json({ success: true, data: schedule });
});

// Submit new loan application by member
memberSelfService.post('/loans/apply', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const member = await db.query(
    "SELECT id, name, status FROM members WHERE id = ? AND deletedAt IS NULL"
  ).get<{ id: string; name: string; status: string }>(memberId);

  if (!member) {
    return c.json({ success: false, message: 'Data anggota tidak ditemukan' }, 404);
  }

  const body = await c.req.json();
  const amount = Number(body.amount);
  const tenor = Number(body.tenor);
  const purpose = String(body.purpose || '').trim();

  if (!amount || isNaN(amount) || amount <= 0) {
    return c.json({ success: false, message: 'Nominal pinjaman harus lebih dari 0' }, 400);
  }
  if (!tenor || isNaN(tenor) || tenor <= 0 || !Number.isInteger(tenor)) {
    return c.json({ success: false, message: 'Tenor pinjaman harus berupa angka bulan yang valid (> 0)' }, 400);
  }
  if (!purpose) {
    return c.json({ success: false, message: 'Keperluan pinjaman wajib diisi' }, 400);
  }

  // Check if member already has a pending loan application
  const existingPending = await db.query(
    "SELECT id FROM loans WHERE memberId = ? AND status = 'Menunggu' AND deletedAt IS NULL"
  ).get(memberId);

  if (existingPending) {
    return c.json({
      success: false,
      message: 'Anda masih memiliki pengajuan pinjaman yang sedang menunggu persetujuan pengurus.'
    }, 400);
  }

  const loanId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.run(
    `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'Menunggu', ?)`,
    [loanId, memberId, member.name, amount, tenor, purpose, createdAt]
  );

  return c.json({
    success: true,
    message: 'Pengajuan pinjaman berhasil dikirim dan sedang menunggu persetujuan pengurus.',
    data: { id: loanId, amount, tenor, purpose, status: 'Menunggu', createdAt }
  });
});

// Financial Report: Income Statement for Members
memberSelfService.get('/reports/income-statement', async (c) => {
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
});

// Financial Report: Balance Sheet for Members
memberSelfService.get('/reports/balance-sheet', async (c) => {
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
});

// Financial Report: Cash Flow Statement for Members
memberSelfService.get('/reports/cashflow-statement', async (c) => {
  const query = `
    SELECT 
      CASE WHEN jl.debit > 0 THEN 'inflow' ELSE 'outflow' END as category, 
      COALESCE(je.reference_type, 'jurnal_umum') as subcategory, 
      SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END) as total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
    GROUP BY category, subcategory
  `;
  const rows = await db.query(query).all();

  const getSubcategoryLabel = (cat: string, subcat: string) => {
    switch (subcat) {
      case 'savings_setor': return 'Setoran Simpanan Anggota';
      case 'loan_payment': return 'Penerimaan Angsuran Pinjaman';
      case 'savings_tarik': return 'Penarikan Simpanan Anggota';
      case 'loan_disbursement': return 'Pencairan Pinjaman Anggota';
      default: return cat === 'inflow' ? 'Penerimaan Kas Lainnya' : 'Pengeluaran Kas / Beban Operasional';
    }
  };

  const inflows = rows
    .filter((r: any) => r.category === 'inflow')
    .map((r: any) => ({
      subcategory: r.subcategory,
      label: getSubcategoryLabel('inflow', r.subcategory),
      total: Number(r.total || 0),
    }));

  const outflows = rows
    .filter((r: any) => r.category === 'outflow')
    .map((r: any) => ({
      subcategory: r.subcategory,
      label: getSubcategoryLabel('outflow', r.subcategory),
      total: Number(r.total || 0),
    }));

  const totalInflow = inflows.reduce((sum, r) => sum + r.total, 0);
  const totalOutflow = outflows.reduce((sum, r) => sum + r.total, 0);
  const netCashFlow = totalInflow - totalOutflow;

  const cashBalanceQuery = `
    SELECT 
      a.code, a.name,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    WHERE a.code IN ('11101', '11102')
    GROUP BY a.code, a.name
  `;
  const cashAccounts = await db.query(cashBalanceQuery).all();
  const totalCashBalance = cashAccounts.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

  return c.json({
    success: true,
    data: {
      inflows,
      outflows,
      totalInflow,
      totalOutflow,
      netCashFlow,
      totalCashBalance,
      cashAccounts: cashAccounts.map((a: any) => ({ ...a, balance: Number(a.balance || 0) })),
    },
  });
});

export default memberSelfService;
