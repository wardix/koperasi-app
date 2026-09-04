import { Hono } from 'hono';
import db from '../db';
import { requirePermission } from '../middleware';
import { getActor, getClientIp, audit } from '../lib/audit';
import {
  getEwaRequestsList,
  getEwaRequestById,
  disburseEwa,
  rejectEwa,
  getPayrollRecap,
  settlePayroll,
  batchImportEmployees,
  getMemberActiveMonthlyLoanInstallment,
  getCurrentPeriodMonth,
  getPayrollCycleDates,
  getEwaPayrollCutoffDay,
  getEwaFeeTiers,
  saveEwaFeeTiers,
  calculateEwaFee,
} from '../services/ewaService';
import {
  ewaEmployeeSchema,
  batchEwaEmployeeImportSchema,
  ewaDisburseSchema,
  ewaRejectSchema,
  ewaPayrollSettleSchema,
  saveEwaFeeTiersSchema,
} from '../schemas';

const ewa = new Hono();

// ---------------------------------------------------------------------------
// EWA Requests Management
// ---------------------------------------------------------------------------

// 1. List EWA Requests
ewa.get('/requests', requirePermission('read:loans'), async (c) => {
  const employeeId = c.req.query('employeeId');
  const periodMonth = c.req.query('periodMonth');
  const status = c.req.query('status');
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);

  const result = await getEwaRequestsList(db, {
    employeeId,
    periodMonth,
    status,
    page,
    limit,
  });

  return c.json({ success: true, ...result });
});

// 1.1 Get Available Payment Sources (Cash/Bank accounts) for EWA Disbursement
ewa.get('/payment-sources', requirePermission('approve:loans'), async (c) => {
  const accounts = await db.query(`
    SELECT id, code, name, type 
    FROM accounts 
    WHERE code LIKE '111%'
    ORDER BY code ASC
  `).all<any>();

  return c.json({ success: true, data: accounts });
});

// 2. Disburse EWA Request
ewa.post('/requests/:id/disburse', requirePermission('approve:loans'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ewaDisburseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c) || 'admin';
  try {
    const disbursed = await disburseEwa(db, id, actor, parsed.data.paymentSourceAccountId);

    await audit(db, {
      actor,
      action: 'disburse_ewa' as any,
      entity: 'ewa_requests',
      entityId: id,
      after: {
        amountRequested: disbursed.amountRequested,
        disbursedAmount: disbursed.disbursedAmount,
        feeAmount: disbursed.feeAmount,
        status: disbursed.status,
      },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: `Dana EWA sebesar Rp ${disbursed.disbursedAmount.toLocaleString('id-ID')} berhasil dicairkan!`,
      data: disbursed,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal mencairkan EWA' }, 400);
  }
});

// 3. Reject EWA Request
ewa.post('/requests/:id/reject', requirePermission('approve:loans'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = ewaRejectSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c) || 'admin';
  try {
    const rejected = await rejectEwa(db, id, actor, parsed.data.reason);

    await audit(db, {
      actor,
      action: 'reject_ewa' as any,
      entity: 'ewa_requests',
      entityId: id,
      after: {
        reason: parsed.data.reason,
        status: rejected.status,
      },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: 'Permohonan EWA telah ditolak',
      data: rejected,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menolak EWA' }, 400);
  }
});

// ---------------------------------------------------------------------------
// Company Employees Management
// ---------------------------------------------------------------------------

// 4. List Company Employees
ewa.get('/employees', requirePermission('read:members'), async (c) => {
  const search = c.req.query('search') || '';
  const status = c.req.query('status') || '';
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search.trim()) {
    conditions.push('(LOWER(name) LIKE ? OR LOWER(nip) LIKE ? OR LOWER(email) LIKE ?)');
    const q = `%${search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (status) {
    conditions.push('LOWER(status) = LOWER(?)');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRes = await db
    .query(`SELECT COUNT(*) as count FROM employees ${whereClause}`)
    .get<any>(...params);
  const total = Number(totalRes?.count || 0);

  const rows = await db
    .query(
      `SELECT 
        id, nip, nik, name, email, phone, department, position,
        base_salary as "baseSalary", member_id as "memberId", is_member as "isMember",
        bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_account_holder as "bankAccountName",
        status, contract_end_date as "contractEndDate", created_at as "createdAt", updated_at as "updatedAt"
       FROM employees
       ${whereClause}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const now = new Date();
  const currentPeriod = getCurrentPeriodMonth(now);
  const cutoffDay = getEwaPayrollCutoffDay();
  const { startDate, endDate, totalDaysInCycle } = getPayrollCycleDates(currentPeriod, cutoffDay);
  const targetUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const clampedTargetTime = Math.min(endDate.getTime(), Math.max(startDate.getTime(), targetUtc));
  const currentDayInCycle = Math.round((clampedTargetTime - startDate.getTime()) / msPerDay) + 1;
  const progressiveRatio = Math.min(1, Math.max(0, currentDayInCycle / totalDaysInCycle));

  const mapped = await Promise.all(
    rows.map(async (r: any) => {
      const baseSalary = Number(r.baseSalary || 0);
      const coopLoanDeduction = await getMemberActiveMonthlyLoanInstallment(db, r.memberId, currentPeriod);
      const effectiveSalary = Math.max(0, baseSalary - coopLoanDeduction);
      const maxMonthlyLimit = Math.floor(effectiveSalary * 0.5);
      const dailyAccumulatedLimit = Math.floor(maxMonthlyLimit * progressiveRatio);
      return {
        ...r,
        baseSalary,
        coopLoanDeduction,
        effectiveSalary,
        dailyAccumulatedLimit,
        isMember: Boolean(r.isMember),
      };
    })
  );

  return c.json({
    success: true,
    data: mapped,
    total,
    page,
    limit,
  });
});

// 5. Batch Import Employees (CSV/Excel)
ewa.post('/employees/batch-import', requirePermission('create:members'), async (c) => {
  const body = await c.req.json();
  const parsed = batchEwaEmployeeImportSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  const result = await batchImportEmployees(db, parsed.data.items);

  await audit(db, {
    actor,
    action: 'import_company_employees' as any,
    entity: 'company_employees',
    after: { processedCount: result.processedCount, failedCount: result.errors.length },
    ip: getClientIp(c),
  });

  return c.json({
    success: true,
    message: `Berhasil memproses ${result.processedCount} data karyawan perusahaan`,
    data: result,
  });
});

// ---------------------------------------------------------------------------
// Payroll Deduction Recap & Settlement (HRD)
// ---------------------------------------------------------------------------

// 6. Get Payroll Deduction Recap
ewa.get('/payroll/recap', requirePermission('read:reports'), async (c) => {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodMonth = c.req.query('periodMonth') || currentPeriod;

  try {
    const recap = await getPayrollRecap(db, periodMonth);
    return c.json({ success: true, data: recap });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat rekap payroll' }, 400);
  }
});

// 7. Settle Payroll Deductions from Parent Company
ewa.post('/payroll/settle', requirePermission('approve:loans'), async (c) => {
  const body = await c.req.json();
  const parsed = ewaPayrollSettleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  try {
    const result = await settlePayroll(
      db,
      parsed.data.periodMonth,
      actor,
      parsed.data.targetAccountId
    );

    await audit(db, {
      actor,
      action: 'settle_ewa_payroll' as any,
      entity: 'ewa_requests',
      after: {
        periodMonth: parsed.data.periodMonth,
        settledCount: result.settledCount,
        totalSettledAmount: result.totalSettledAmount,
      },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: `Pelunasan payroll periode ${parsed.data.periodMonth} berhasil dibukukan! Total: Rp ${result.totalSettledAmount.toLocaleString('id-ID')}`,
      data: result,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memproses pelunasan payroll' }, 400);
  }
});

// ---------------------------------------------------------------------------
// Fee Tiers Management
// ---------------------------------------------------------------------------

// 8. Get Fee Tiers
ewa.get('/fee-tiers', async (c) => {
  try {
    const tiers = await getEwaFeeTiers(db);
    return c.json({ success: true, data: tiers });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal memuat tabel tarif biaya admin' }, 500);
  }
});

// 9. Update/Save Fee Tiers (Admin)
ewa.put('/fee-tiers', requirePermission('update:settings'), async (c) => {
  const body = await c.req.json();
  const parsed = saveEwaFeeTiersSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const actor = getActor(c);
  try {
    const beforeTiers = await getEwaFeeTiers(db);
    const updated = await saveEwaFeeTiers(db, parsed.data.tiers as any);

    await audit(db, {
      actor,
      action: 'update_ewa_fee_tiers' as any,
      entity: 'ewa_fee_tiers',
      before: { count: beforeTiers.length, tiers: beforeTiers },
      after: { count: updated.length, tiers: updated },
      ip: getClientIp(c),
    });

    return c.json({
      success: true,
      message: 'Tabel tarif biaya admin EWA berhasil disimpan!',
      data: updated,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menyimpan tabel tarif' }, 400);
  }
});

// 10. Calculate Fee Real-Time Preview
ewa.post('/calculate-fee', async (c) => {
  try {
    const body = await c.req.json();
    const amount = Number(body.amount || 0);
    const isMember = Boolean(body.isMember);

    const calc = await calculateEwaFee(db, amount, isMember);
    return c.json({
      success: true,
      data: {
        amount,
        isMember,
        feeAmount: calc.feeAmount,
        feePercentage: calc.feePercentage,
        disbursedAmount: amount,
        totalPayrollDeduction: amount + calc.feeAmount,
        tier: calc.tier,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || 'Gagal menghitung biaya admin' }, 400);
  }
});

export default ewa;
