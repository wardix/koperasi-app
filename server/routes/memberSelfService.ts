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

import {
  getEmployeeByEmail,
  getEmployeeById,
  getEmployeeEwaQuota,
  createEwaRequest,
  getEwaRequestsList,
  getEwaFeeTiers,
} from '../services/ewaService';
import { ewaRequestCreateSchema, savingsWithdrawalCreateSchema } from '../schemas';
import {
  getMemberWithdrawals,
  createSavingsWithdrawalRequest,
} from '../services/savingsWithdrawalService';

// Get member / employee profile and savings summary
memberSelfService.get('/profile', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const memberId = payload.sub;
  const email = payload.email;

  const member = await db.query(
    "SELECT id, name, role, status, joinDate, nik, phone, simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?"
  ).get<any>(memberId);

  // Look up employee record by email or memberId
  let employee = null;
  if (email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && memberId) {
    const empByMember = await db.query("SELECT id FROM employees WHERE member_id = ? LIMIT 1").get<any>(memberId);
    if (empByMember?.id) {
      employee = await getEmployeeById(db, empByMember.id);
    }
  }

  if (!member && !employee) {
    return c.json({ success: false, message: 'Data pengguna tidak ditemukan' }, 404);
  }

  const isCoopMember = !!member;
  const bungaSetting = await db
    .query("SELECT value FROM settings WHERE key = 'bungaPinjaman'")
    .get<{ value: string }>();
  const loanInterestRate = parseFloat(bungaSetting?.value || "0");

  const profileData = {
    id: member?.id || employee?.id,
    name: member?.name || employee?.name,
    email: member?.email || employee?.email,
    phone: member?.phone || employee?.phone,
    role: member?.role || 'Karyawan',
    status: member?.status || employee?.status || 'Aktif',
    joinDate: member?.joinDate
      ? String(member.joinDate).slice(0, 10)
      : employee?.createdAt
      ? new Date(employee.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    nik: member?.nik || employee?.nik,
    simpananPokok: Number(member?.simpananPokok || 0),
    simpananWajib: Number(member?.simpananWajib || 0),
    simpananSukarela: Number(member?.simpananSukarela || 0),
    totalSavings: Number(member?.totalSavings || 0),
    isCoopMember,
    loanInterestRate,
    employee: employee ? {
      id: employee.id,
      nip: employee.nip,
      department: employee.department,
      position: employee.position,
      baseSalary: employee.baseSalary,
      isMember: employee.isMember,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      bankAccountName: employee.bankAccountName,
    } : null,
  };

  return c.json({ success: true, data: profileData });
});

// ---------------------------------------------------------------------------
// EWA (Earned Wage Access) Portal Endpoints
// ---------------------------------------------------------------------------

// 1. Get current employee EWA quota & simulation
memberSelfService.get('/ewa/quota', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empByMember = await db.query("SELECT id FROM employees WHERE member_id = ? LIMIT 1").get<any>(payload.sub);
    if (empByMember?.id) {
      employee = await getEmployeeById(db, empByMember.id);
    }
  }

  if (!employee) {
    return c.json({
      success: false,
      message: 'Data karyawan perusahaan tidak ditemukan. Layanan EWA hanya berlaku untuk karyawan perusahaan induk terdaftar.',
    }, 404);
  }

  try {
    const quota = await getEmployeeEwaQuota(db, employee.id);
    const feeTiers = await getEwaFeeTiers(db);
    return c.json({
      success: true,
      data: {
        ...quota,
        employee,
        feeTiers,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat kuota EWA' }, 400);
  }
});

// 2. Get Fee Tiers
memberSelfService.get('/ewa/fee-tiers', async (c) => {
  try {
    const tiers = await getEwaFeeTiers(db);
    return c.json({ success: true, data: tiers });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat tabel tarif' }, 500);
  }
});

// 3. Submit EWA Request
memberSelfService.get('/ewa/history', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empByMember = await db.query("SELECT id FROM employees WHERE member_id = ? LIMIT 1").get<any>(payload.sub);
    if (empByMember?.id) {
      employee = await getEmployeeById(db, empByMember.id);
    }
  }

  if (!employee) {
    return c.json({ success: true, data: [] });
  }

  const list = await getEwaRequestsList(db, { employeeId: employee.id, limit: 50 });
  return c.json({ success: true, data: list.data });
});

// 3. Submit EWA Request
memberSelfService.post('/ewa/request', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload & { employeeId?: string };
  const email = payload.email;

  let employee = null;
  if (payload.employeeId) {
    employee = await getEmployeeById(db, payload.employeeId);
  }
  if (!employee && email) {
    employee = await getEmployeeByEmail(db, email);
  }
  if (!employee && payload.sub) {
    const empByMember = await db.query("SELECT id FROM employees WHERE member_id = ? LIMIT 1").get<any>(payload.sub);
    if (empByMember?.id) {
      employee = await getEmployeeById(db, empByMember.id);
    }
  }

  if (!employee) {
    return c.json({
      success: false,
      message: 'Data karyawan perusahaan tidak ditemukan. Layanan EWA hanya berlaku untuk karyawan perusahaan induk terdaftar.',
    }, 404);
  }

  const body = await c.req.json();
  const parsed = ewaRequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  try {
    const result = await createEwaRequest(db, employee.id, parsed.data);
    return c.json({
      success: true,
      message: 'Pengajuan penarikan EWA berhasil dikirim! Menunggu proses pencairan oleh bagian kasir/keuangan.',
      data: result,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mengajukan EWA' }, 400);
  }
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

// Get voluntary savings withdrawal requests history for logged-in member
memberSelfService.get('/savings/withdrawals', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const withdrawals = await getMemberWithdrawals(db, memberId);
  return c.json({ success: true, data: withdrawals });
});

// Submit a new voluntary savings withdrawal request
memberSelfService.post('/savings/withdraw', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const body = await c.req.json().catch(() => ({}));
  const parsed = savingsWithdrawalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  try {
    const result = await createSavingsWithdrawalRequest(db, memberId, parsed.data);
    return c.json({
      success: true,
      message: 'Permohonan penarikan simpanan sukarela berhasil dikirim! Menunggu persetujuan pengurus/bendahara.',
      data: result,
    }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mengajukan penarikan simpanan sukarela' }, 400);
  }
});


// Get member loans (paidAmount is not a loans column — sum from loan_payments)
memberSelfService.get('/loans', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const loans = await db.query(
    `SELECT l.id, COALESCE(m.name, l.name) AS name, l.amount, l.tenor, l.purpose, l.status, l.createdAt,
            l.interestRate, l.monthlyPayment, l.interestAmount, l.totalAmount,
            l.approvedAt, l.totalInstallments, l.paidInstallments,
            l."attachmentUrl", l."attachmentName",
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

// Get payment history for a specific loan
memberSelfService.get('/loans/:loanId/payments', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;
  const loanId = c.req.param('loanId');

  // Verify the loan belongs to the member
  const loan = await db.query("SELECT id FROM loans WHERE id = ? AND memberId = ?").get(loanId, memberId);
  if (!loan) {
    return c.json({ success: false, message: 'Loan not found or unauthorized' }, 404);
  }

  const payments = await db.query(
    'SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE loanId = ? ORDER BY paymentDate ASC, id ASC'
  ).all(loanId);

  return c.json({ success: true, data: payments });
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
  const attachmentUrl = body.attachmentUrl ? String(body.attachmentUrl).trim() : null;
  const attachmentName = body.attachmentName ? String(body.attachmentName).trim() : null;

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
    `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, "attachmentUrl", "attachmentName")
     VALUES (?, ?, ?, ?, ?, ?, 'Menunggu', ?, ?, ?)`,
    [loanId, memberId, member.name, amount, tenor, purpose, createdAt, attachmentUrl, attachmentName]
  );

  return c.json({
    success: true,
    message: 'Pengajuan pinjaman berhasil dikirim dan sedang menunggu persetujuan pengurus.',
    data: { id: loanId, amount, tenor, purpose, status: 'Menunggu', createdAt, attachmentUrl, attachmentName }
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
    WHERE a.code IN ('11101', '11102') AND (a_counter.code NOT IN ('11101', '11102') OR a_counter.code IS NULL)
    GROUP BY category, counter_code, counter_name, counter_type, reference_type
    ORDER BY category, total DESC
  `;
  const rows = await db.query(query).all();

  const getDetailLabel = (category: string, counterCode: string, counterName: string) => {
    if (category === 'inflow') {
      switch (counterCode) {
        case '31101': return 'Setoran Simpanan Pokok Anggota';
        case '31102': return 'Setoran Simpanan Wajib Anggota';
        case '21101': return 'Setoran Simpanan Sukarela Anggota';
        case '11201': return 'Penerimaan Angsuran Pokok Pinjaman';
        case '41101': return 'Penerimaan Jasa / Bunga Pinjaman';
        case '41102': return 'Penerimaan Provisi & Administrasi';
        case '41103': return 'Penerimaan Biaya Layanan Gaji Awal (EWA)';
        case '11301': return 'Pelunasan Payroll Kasbon Gaji (EWA)';
        case '42101': return 'Penerimaan Bunga Bank / Jasa Giro';
        case '42102': return 'Penerimaan Pendapatan Denda';
        case '21201': return 'Penerimaan Kas Awal Koperasi';
        default: return `Penerimaan: ${counterName}`;
      }
    } else {
      switch (counterCode) {
        case '11201': return 'Pencairan Penyaluran Pinjaman';
        case '21101': return 'Penarikan Simpanan Sukarela';
        case '11301': return 'Pencairan Kasbon Gaji Awal (EWA)';
        case '61101': return 'Pembayaran Beban Gaji & Tunjangan';
        case '61201': return 'Pembayaran Beban Operasional Kantor';
        case '61301': return 'Pembayaran Beban Pelaksanaan RAT';
        case '12101': return 'Pengeluaran Pembelian Peralatan';
        case '11401': return 'Pengeluaran Pembelian Perlengkapan';
        default: return `Pengeluaran: ${counterName}`;
      }
    }
  };

  const inflows = rows
    .filter((r: any) => r.category === 'inflow')
    .map((r: any) => ({
      subcategory: r.counter_name || r.reference_type,
      accountCode: r.counter_code,
      accountName: r.counter_name,
      label: getDetailLabel('inflow', r.counter_code, r.counter_name),
      total: Number(r.total || 0),
    }));

  const outflows = rows
    .filter((r: any) => r.category === 'outflow')
    .map((r: any) => ({
      subcategory: r.counter_name || r.reference_type,
      accountCode: r.counter_code,
      accountName: r.counter_name,
      label: getDetailLabel('outflow', r.counter_code, r.counter_name),
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
