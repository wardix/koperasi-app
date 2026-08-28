import type { Db } from "../db";
import { ServiceError } from "./errors";
import type { CompanyEmployee, EWARequest, EwaQuotaInfo, EwaFeeTier } from "../../shared/types";

export const EWA_MAX_PERCENTAGE = 50; // 50% from monthly base salary
export const EWA_MEMBER_FEE_PCT = 2.0; // 2.0% for Cooperative Members
export const EWA_NON_MEMBER_FEE_PCT = 3.5; // 3.5% for Non-Members

export async function getEwaFeeTiers(db: Db): Promise<EwaFeeTier[]> {
  const rows = await db
    .query(
      `SELECT 
        id, min_amount as "minAmount", max_amount as "maxAmount",
        member_fee as "memberFee", non_member_fee as "nonMemberFee",
        tier_order as "tierOrder", created_at as "createdAt", updated_at as "updatedAt"
       FROM ewa_fee_tiers
       ORDER BY tier_order ASC, min_amount ASC`
    )
    .all<any>();

  return rows.map((r) => ({
    id: r.id,
    minAmount: Number(r.minAmount),
    maxAmount: r.maxAmount != null ? Number(r.maxAmount) : null,
    memberFee: Number(r.memberFee),
    nonMemberFee: Number(r.nonMemberFee),
    tierOrder: Number(r.tierOrder || 1),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  }));
}

export async function saveEwaFeeTiers(
  db: Db,
  tiers: Array<{
    id?: string;
    minAmount: number;
    maxAmount?: number | null;
    memberFee: number;
    nonMemberFee: number;
    tierOrder?: number;
  }>
): Promise<EwaFeeTier[]> {
  await db.transaction(async () => {
    // Delete existing
    await db.run("DELETE FROM ewa_fee_tiers");

    // Insert new
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const id = t.id || crypto.randomUUID();
      const order = t.tierOrder ?? (i + 1);
      const minAmount = Math.max(0, Number(t.minAmount || 0));
      const maxAmount = t.maxAmount != null ? Number(t.maxAmount) : null;
      const memberFee = Math.max(0, Number(t.memberFee || 0));
      const nonMemberFee = Math.max(0, Number(t.nonMemberFee || 0));

      await db.query(
        `INSERT INTO ewa_fee_tiers (id, min_amount, max_amount, member_fee, non_member_fee, tier_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`
      ).run(id, minAmount, maxAmount, memberFee, nonMemberFee, order);
    }
  })();

  return getEwaFeeTiers(db);
}

export async function calculateEwaFee(
  db: Db,
  requestedAmount: number,
  isMember: boolean
): Promise<{ feeAmount: number; feePercentage: number; tier: EwaFeeTier | null }> {
  const tiers = await getEwaFeeTiers(db);
  const matched = tiers.find((t) => {
    if (requestedAmount < t.minAmount) return false;
    if (t.maxAmount != null && requestedAmount > t.maxAmount) return false;
    return true;
  });

  if (matched) {
    const feeAmount = isMember ? matched.memberFee : matched.nonMemberFee;
    const feePercentage = requestedAmount > 0 ? Math.round((feeAmount / requestedAmount) * 10000) / 100 : 0;
    return { feeAmount, feePercentage, tier: matched };
  }

  // Fallback to percentage if no tier matched
  const feePercentage = isMember ? EWA_MEMBER_FEE_PCT : EWA_NON_MEMBER_FEE_PCT;
  const feeAmount = Math.round((requestedAmount * feePercentage) / 100);
  return { feeAmount, feePercentage, tier: null };
}

export function getEwaPayrollCutoffDay(): number {
  const envVal =
    process.env.EWA_PAYROLL_CUTOFF_DAY ||
    (typeof Bun !== "undefined" ? Bun.env.EWA_PAYROLL_CUTOFF_DAY : undefined) ||
    process.env.VITE_EWA_PAYROLL_CUTOFF_DAY ||
    (typeof Bun !== "undefined" ? Bun.env.VITE_EWA_PAYROLL_CUTOFF_DAY : undefined);

  if (envVal !== undefined && envVal !== "") {
    const parsed = parseInt(String(envVal), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
      return parsed;
    }
  }

  const startEnvVal =
    process.env.EWA_CYCLE_START_DAY ||
    (typeof Bun !== "undefined" ? Bun.env.EWA_CYCLE_START_DAY : undefined) ||
    process.env.VITE_EWA_CYCLE_START_DAY ||
    (typeof Bun !== "undefined" ? Bun.env.VITE_EWA_CYCLE_START_DAY : undefined);

  if (startEnvVal !== undefined && startEnvVal !== "") {
    const parsed = parseInt(String(startEnvVal), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
      return parsed === 1 ? 31 : parsed - 1;
    }
  }

  return 25; // Default: 25th is the cutoff day
}

export function getCurrentPeriodMonth(asOfDate?: Date | string): string {
  const target = asOfDate ? new Date(asOfDate) : new Date();
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  const day = target.getDate();
  const cutoff = getEwaPayrollCutoffDay();

  let pYear = year;
  let pMonth = month;

  if (cutoff > 0 && cutoff < 31 && day > cutoff) {
    pMonth += 1;
    if (pMonth > 12) {
      pMonth = 1;
      pYear += 1;
    }
  }

  return `${pYear}-${String(pMonth).padStart(2, "0")}`;
}

export function getPayrollCycleDates(periodMonth: string, cutoffDay: number = getEwaPayrollCutoffDay()) {
  const [yearStr, monthStr] = periodMonth.split("-");
  const pYear = parseInt(yearStr, 10);
  const pMonth = parseInt(monthStr, 10);

  let startYear = pYear;
  let startMonth = pMonth - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear -= 1;
  }

  const startDay = cutoffDay === 31 ? 1 : cutoffDay + 1;
  const endDay = cutoffDay;

  const maxDaysInStartMonth = new Date(startYear, startMonth, 0).getDate();
  const actualStartDay = Math.min(startDay, maxDaysInStartMonth);

  const maxDaysInEndMonth = new Date(pYear, pMonth, 0).getDate();
  const actualEndDay = Math.min(endDay, maxDaysInEndMonth);

  const startDate = new Date(Date.UTC(startYear, startMonth - 1, actualStartDay));
  const endDate = new Date(Date.UTC(pYear, pMonth - 1, actualEndDay));

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDaysInCycle = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;

  return {
    cycleStartDateStr: startDate.toISOString().slice(0, 10),
    cycleEndDateStr: endDate.toISOString().slice(0, 10),
    startDate,
    endDate,
    totalDaysInCycle,
  };
}

export async function syncEmployeeMemberStatus(db: Db, employeeId: string): Promise<void> {
  const emp = await db
    .query("SELECT id, email, nik FROM company_employees WHERE id = ?")
    .get<{ id: string; email: string; nik?: string | null }>(employeeId);
  if (!emp) return;

  // Check if email or NIK matches an active member
  const member = await db
    .query(
      `SELECT id FROM members 
       WHERE deletedAt IS NULL AND status = 'Aktif' 
       AND (LOWER(email) = LOWER(?) OR (nik IS NOT NULL AND nik != '' AND nik = ?))
       LIMIT 1`
    )
    .get<{ id: string }>(emp.email, emp.nik || "");

  if (member) {
    await db
      .query("UPDATE company_employees SET member_id = ?, is_member = true, updated_at = NOW() WHERE id = ?")
      .run(member.id, emp.id);
  } else {
    await db
      .query("UPDATE company_employees SET member_id = NULL, is_member = false, updated_at = NOW() WHERE id = ?")
      .run(emp.id);
  }
}

export function isContractExpired(contractEndDate?: string | null): boolean {
  if (!contractEndDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  const end = String(contractEndDate).slice(0, 10);
  return today > end;
}

export async function getEmployeeByEmail(db: Db, email: string): Promise<CompanyEmployee | null> {
  const normEmail = email.trim().toLowerCase();
  const row = await db
    .query(
      `SELECT 
        id, nip, nik, name, email, phone, department, position,
        base_salary as "baseSalary", member_id as "memberId", is_member as "isMember",
        bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_account_name as "bankAccountName",
        status, contract_end_date as "contractEndDate", created_at as "createdAt", updated_at as "updatedAt"
       FROM company_employees 
       WHERE LOWER(email) = ? AND status = 'ACTIVE' LIMIT 1`
    )
    .get<any>(normEmail);

  if (!row) return null;

  // Auto-sync member status
  await syncEmployeeMemberStatus(db, row.id);

  // Re-fetch synchronized record
  const synced = await db
    .query(
      `SELECT 
        id, nip, nik, name, email, phone, department, position,
        base_salary as "baseSalary", member_id as "memberId", is_member as "isMember",
        bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_account_name as "bankAccountName",
        status, contract_end_date as "contractEndDate", created_at as "createdAt", updated_at as "updatedAt"
       FROM company_employees 
       WHERE id = ? LIMIT 1`
    )
    .get<any>(row.id);

  return {
    ...synced,
    baseSalary: Number(synced.baseSalary || 0),
    isMember: Boolean(synced.isMember),
  };
}

export async function getEmployeeById(db: Db, employeeId: string): Promise<CompanyEmployee | null> {
  await syncEmployeeMemberStatus(db, employeeId);
  const row = await db
    .query(
      `SELECT 
        id, nip, nik, name, email, phone, department, position,
        base_salary as "baseSalary", member_id as "memberId", is_member as "isMember",
        bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_account_name as "bankAccountName",
        status, contract_end_date as "contractEndDate", created_at as "createdAt", updated_at as "updatedAt"
       FROM company_employees 
       WHERE id = ? LIMIT 1`
    )
    .get<any>(employeeId);

  if (!row) return null;
  return {
    ...row,
    baseSalary: Number(row.baseSalary || 0),
    isMember: Boolean(row.isMember),
  };
}

export async function getMemberActiveMonthlyLoanInstallment(
  db: Db,
  memberId?: string | null,
  periodMonth?: string
): Promise<number> {
  if (!memberId) return 0;
  const period = periodMonth || getCurrentPeriodMonth();

  // 1. Check from loan_schedules for active loans ('Disetujui')
  // Match only the schedule due in this specific period month (1 month installment)
  const schedRes = await db
    .query(
      `SELECT COALESCE(SUM(ls.principalAmount + ls.interestAmount - ls.paidAmount), 0) as total
       FROM loan_schedules ls
       JOIN loans l ON ls.loanId = l.id
       WHERE l.memberId = ? 
         AND l.status = 'Disetujui'
         AND ls.status IN ('Pending', 'Late')
         AND TO_CHAR(ls.dueDate, 'YYYY-MM') = ?`
    )
    .get<{ total: string | number }>(memberId, period);

  const schedTotal = Number(schedRes?.total || 0);
  if (schedTotal > 0) return schedTotal;

  // 2. Fallback: if no schedule rows exist for approved loan, calculate monthly payment from loan terms
  const loans = await db
    .query(
      `SELECT id, amount, tenor, interestRate
       FROM loans
       WHERE memberId = ? AND status = 'Disetujui'`
    )
    .all<{ id: string; amount: number; tenor: number; interestRate?: number }>(memberId);

  let fallbackTotal = 0;
  for (const l of loans) {
    const countRes = await db
      .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ?`)
      .get<{ count: string | number }>(l.id);
    if (Number(countRes?.count || 0) === 0) {
      const p = Number(l.amount || 0);
      const t = Number(l.tenor || 1);
      const r = Number(l.interestRate || 0) / 100;
      const monthly = Math.round(p / t + p * r);
      fallbackTotal += monthly;
    }
  }

  return fallbackTotal;
}

export async function getEmployeeEwaQuota(
  db: Db,
  employeeId: string,
  periodMonth?: string,
  asOfDate?: Date | string
): Promise<EwaQuotaInfo> {
  const emp = await getEmployeeById(db, employeeId);
  if (!emp) {
    throw new ServiceError("Data karyawan tidak ditemukan", 404);
  }

  const cutoffDay = getEwaPayrollCutoffDay();
  const period = periodMonth || getCurrentPeriodMonth(asOfDate);
  const coopLoanDeduction = await getMemberActiveMonthlyLoanInstallment(db, emp.memberId, period);
  const effectiveSalary = Math.max(0, emp.baseSalary - coopLoanDeduction);
  const maxMonthlyLimit = Math.floor((effectiveSalary * EWA_MAX_PERCENTAGE) / 100);

  // Progressive daily accrual calculation based on payroll cycle
  const { cycleStartDateStr, cycleEndDateStr, startDate, endDate, totalDaysInCycle } = getPayrollCycleDates(period, cutoffDay);

  const targetDate = asOfDate ? new Date(asOfDate) : new Date();
  const targetUtc = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;

  const clampedTargetTime = Math.min(endDate.getTime(), Math.max(startDate.getTime(), targetUtc));
  const currentDayInCycle = Math.round((clampedTargetTime - startDate.getTime()) / msPerDay) + 1;

  const progressiveRatio = Math.min(1, Math.max(0, currentDayInCycle / totalDaysInCycle));
  const progressivePercentage = Math.round(progressiveRatio * 10000) / 100;
  const dailyAccumulatedLimit = Math.floor(maxMonthlyLimit * progressiveRatio);

  // Sum used advances in this period (PENDING, APPROVED, DISBURSED)
  const usedRes = await db
    .query(
      `SELECT COALESCE(SUM(amount_requested), 0) as used
       FROM ewa_requests
       WHERE employee_id = ? AND period_month = ? AND status IN ('PENDING', 'APPROVED', 'DISBURSED')`
    )
    .get<{ used: string | number }>(employeeId, period);

  const totalUsedThisMonth = Number(usedRes?.used || 0);
  const remainingQuota = Math.max(0, dailyAccumulatedLimit - totalUsedThisMonth);
  const feePercentage = emp.isMember ? EWA_MEMBER_FEE_PCT : EWA_NON_MEMBER_FEE_PCT;

  const isExpired = isContractExpired(emp.contractEndDate);
  const isZeroEffective = effectiveSalary <= 0;
  const isEligible = !isExpired && !isZeroEffective && emp.status === 'ACTIVE';
  const ineligibilityReason = isExpired
    ? `Masa kontrak kerja telah berakhir pada ${String(emp.contractEndDate).slice(0, 10)}. Pengajuan EWA tidak dapat diproses.`
    : isZeroEffective
    ? `Gaji bersih setelah dipotong angsuran pinjaman koperasi (Rp ${coopLoanDeduction.toLocaleString('id-ID')}) adalah Rp 0, sehingga kuota EWA tidak tersedia.`
    : emp.status !== 'ACTIVE'
    ? 'Status karyawan tidak aktif.'
    : null;

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    isMember: emp.isMember,
    periodMonth: period,
    baseSalary: emp.baseSalary,
    coopLoanDeduction,
    effectiveSalary,
    maxAllowedPercentage: EWA_MAX_PERCENTAGE,
    maxMonthlyLimit,
    currentDay: targetDate.getDate(),
    currentDayInCycle,
    totalDaysInCycle,
    cycleStartDate: cycleStartDateStr,
    cycleEndDate: cycleEndDateStr,
    cutoffDay,
    progressivePercentage,
    dailyAccumulatedLimit,
    totalUsedThisMonth,
    remainingQuota: isEligible ? remainingQuota : 0,
    feePercentage,
    isEligible,
    ineligibilityReason,
    contractEndDate: emp.contractEndDate ? String(emp.contractEndDate).slice(0, 10) : null,
  };
}

export async function createEwaRequest(
  db: Db,
  employeeId: string,
  input: {
    amount: number;
    destinationBank?: string;
    destinationAccount?: string;
    destinationName?: string;
  }
): Promise<EWARequest> {
  const emp = await getEmployeeById(db, employeeId);
  if (!emp) {
    throw new ServiceError("Data karyawan tidak ditemukan", 404);
  }

  if (isContractExpired(emp.contractEndDate)) {
    throw new ServiceError(
      `Pengajuan EWA gagal: masa kontrak kerja telah berakhir pada ${String(emp.contractEndDate).slice(0, 10)}.`,
      400
    );
  }

  const quota = await getEmployeeEwaQuota(db, employeeId);
  const requestedAmount = Math.round(Number(input.amount));

  if (!quota.isEligible) {
    throw new ServiceError(quota.ineligibilityReason || "Karyawan tidak memenuhi syarat pengajuan EWA", 400);
  }

  if (requestedAmount <= 0) {
    throw new ServiceError("Nominal penarikan harus lebih dari 0", 400);
  }

  if (requestedAmount > quota.remainingQuota) {
    throw new ServiceError(
      `Nominal penarikan (Rp ${requestedAmount.toLocaleString("id-ID")}) melebihi sisa kuota bulan ini (Rp ${quota.remainingQuota.toLocaleString("id-ID")})`,
      400
    );
  }

  const destBank = input.destinationBank || emp?.bankName || "Bank Mandiri";
  const destAcc = input.destinationAccount || emp?.bankAccountNumber || "-";
  const destName = input.destinationName || emp?.bankAccountName || emp?.name || "-";

  const feeCalc = await calculateEwaFee(db, requestedAmount, emp.isMember);
  const feePercentage = feeCalc.feePercentage;
  const feeAmount = feeCalc.feeAmount;
  const disbursedAmount = requestedAmount;
  const totalPayrollDeduction = requestedAmount + feeAmount;

  const id = crypto.randomUUID();
  const periodMonth = quota.periodMonth;

  await db.query(
    `INSERT INTO ewa_requests (
      id, employee_id, period_month, salary_basis, max_limit,
      amount_requested, fee_percentage, fee_amount, disbursed_amount, total_payroll_deduction,
      destination_bank, destination_account, destination_name, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`
  ).run(
    id,
    employeeId,
    periodMonth,
    quota.effectiveSalary ?? quota.baseSalary,
    quota.maxMonthlyLimit,
    requestedAmount,
    feePercentage,
    feeAmount,
    disbursedAmount,
    totalPayrollDeduction,
    destBank,
    destAcc,
    destName
  );

  const row = await db
    .query(
      `SELECT 
        r.id, r.employee_id as "employeeId", e.name as "employeeName", e.nip as "employeeNip",
        e.is_member as "isMember", r.period_month as "periodMonth", r.salary_basis as "salaryBasis",
        r.max_limit as "maxLimit", r.amount_requested as "amountRequested", r.fee_percentage as "feePercentage",
        r.fee_amount as "feeAmount", r.disbursed_amount as "disbursedAmount", r.total_payroll_deduction as "totalPayrollDeduction",
        r.destination_bank as "destinationBank", r.destination_account as "destinationAccount", r.destination_name as "destinationName",
        r.status, r.rejection_reason as "rejectionReason", r.disbursed_at as "disbursedAt", r.disbursed_by as "disbursedBy",
        r.settled_at as "settledAt", r.created_at as "createdAt"
       FROM ewa_requests r
       JOIN company_employees e ON r.employee_id = e.id
       WHERE r.id = ?`
    )
    .get<any>(id);

  return {
    ...row,
    salaryBasis: Number(row.salaryBasis || 0),
    maxLimit: Number(row.maxLimit || 0),
    amountRequested: Number(row.amountRequested || 0),
    feePercentage: Number(row.feePercentage || 0),
    feeAmount: Number(row.feeAmount || 0),
    disbursedAmount: Number(row.disbursedAmount || 0),
    totalPayrollDeduction: Number(row.totalPayrollDeduction || 0),
  };
}

export async function disburseEwa(
  db: Db,
  requestId: string,
  adminId?: string,
  paymentSourceAccountId?: string
): Promise<EWARequest> {
  const req = await db
    .query(
      `SELECT r.*, e.name as employee_name, e.nip as employee_nip 
       FROM ewa_requests r 
       JOIN company_employees e ON r.employee_id = e.id 
       WHERE r.id = ?`
    )
    .get<any>(requestId);

  if (!req) {
    throw new ServiceError("Permohonan EWA tidak ditemukan", 404);
  }

  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw new ServiceError(`Tidak dapat mencairkan EWA dengan status ${req.status}`, 400);
  }

  // 1. Determine Accounts for Auto-Journal
  // Dr. 11301 Piutang Potong Gaji (Payroll) = total_payroll_deduction
  // Cr. 11101 Kas Kecil = disbursed_amount
  // Cr. 41103 Pendapatan Administrasi EWA = fee_amount
  let sourceAccountId = paymentSourceAccountId;
  if (!sourceAccountId) {
    const kasAcc = await db.query("SELECT id FROM accounts WHERE code = '11101' LIMIT 1").get<{ id: string }>();
    sourceAccountId = kasAcc?.id;
  }

  const payrollReceivableAcc = await db
    .query("SELECT id FROM accounts WHERE code = '11301' LIMIT 1")
    .get<{ id: string }>();
  const ewaRevenueAcc = await db
    .query("SELECT id FROM accounts WHERE code = '41103' LIMIT 1")
    .get<{ id: string }>();

  let journalEntryId: string | null = null;

  // Verify valid admin ID in admins table
  let validAdminId: string | null = null;
  if (adminId) {
    const adminRow = await db.query("SELECT id FROM admins WHERE id = ?").get<{ id: string }>(adminId);
    if (adminRow?.id) {
      validAdminId = adminRow.id;
    } else {
      const firstAdmin = await db.query("SELECT id FROM admins LIMIT 1").get<{ id: string }>();
      validAdminId = firstAdmin?.id || null;
    }
  }

  if (sourceAccountId && payrollReceivableAcc?.id) {
    journalEntryId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];
    const totalDeduction = Number(req.total_payroll_deduction);
    const disbursed = Number(req.disbursed_amount);
    const fee = Number(req.fee_amount);

    await db.query(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by, created_at)
       VALUES (?, ?, ?, 'ewa_disbursement', ?, ?, NOW())`
    ).run(
      journalEntryId,
      today,
      `Pencairan EWA Kasbon Karyawan: ${req.employee_name} (${req.employee_nip})`,
      requestId,
      validAdminId
    );

    // Dr. Piutang Potong Gaji
    await db.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).run(
      crypto.randomUUID(),
      journalEntryId,
      payrollReceivableAcc.id,
      totalDeduction,
      `Piutang Payroll EWA ${req.employee_name}`
    );

    // Cr. Kas/Bank
    await db.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, 0, ?, ?)`
    ).run(
      crypto.randomUUID(),
      journalEntryId,
      sourceAccountId,
      disbursed,
      `Transfer Pencairan EWA ke ${req.destination_bank} ${req.destination_account}`
    );

    // Cr. Pendapatan Administrasi EWA (if fee > 0 and account exists)
    if (fee > 0 && ewaRevenueAcc?.id) {
      await db.query(
        `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
         VALUES (?, ?, ?, 0, ?, ?)`
      ).run(
        crypto.randomUUID(),
        journalEntryId,
        ewaRevenueAcc.id,
        fee,
        `Fee Layanan EWA ${req.fee_percentage}% ${req.employee_name}`
      );
    }
  }

  // 2. Update EWA request status
  await db.query(
    `UPDATE ewa_requests 
     SET status = 'DISBURSED', disbursed_at = NOW(), disbursed_by = ?, journal_entry_id = ?, updated_at = NOW() 
     WHERE id = ?`
  ).run(validAdminId, journalEntryId, requestId);

  return (await getEwaRequestById(db, requestId))!;
}

export async function rejectEwa(db: Db, requestId: string, adminId?: string, reason?: string): Promise<EWARequest> {
  const req = await db.query("SELECT id, status FROM ewa_requests WHERE id = ?").get<{ id: string; status: string }>(requestId);
  if (!req) throw new ServiceError("Permohonan EWA tidak ditemukan", 404);
  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw new ServiceError(`Tidak dapat menolak EWA dengan status ${req.status}`, 400);
  }

  await db.query(
    `UPDATE ewa_requests SET status = 'REJECTED', rejection_reason = ?, updated_at = NOW() WHERE id = ?`
  ).run(reason || 'Ditolak oleh admin', requestId);

  return (await getEwaRequestById(db, requestId))!;
}

export async function getEwaRequestById(db: Db, id: string): Promise<EWARequest | null> {
  const row = await db
    .query(
      `SELECT 
        r.id, r.employee_id as "employeeId", e.name as "employeeName", e.nip as "employeeNip",
        e.is_member as "isMember", r.period_month as "periodMonth", r.salary_basis as "salaryBasis",
        r.max_limit as "maxLimit", r.amount_requested as "amountRequested", r.fee_percentage as "feePercentage",
        r.fee_amount as "feeAmount", r.disbursed_amount as "disbursedAmount", r.total_payroll_deduction as "totalPayrollDeduction",
        r.destination_bank as "destinationBank", r.destination_account as "destinationAccount", r.destination_name as "destinationName",
        r.status, r.rejection_reason as "rejectionReason", r.disbursed_at as "disbursedAt", r.disbursed_by as "disbursedBy",
        r.settled_at as "settledAt", r.created_at as "createdAt"
       FROM ewa_requests r
       JOIN company_employees e ON r.employee_id = e.id
       WHERE r.id = ?`
    )
    .get<any>(id);

  if (!row) return null;
  return {
    ...row,
    salaryBasis: Number(row.salaryBasis || 0),
    maxLimit: Number(row.maxLimit || 0),
    amountRequested: Number(row.amountRequested || 0),
    feePercentage: Number(row.feePercentage || 0),
    feeAmount: Number(row.feeAmount || 0),
    disbursedAmount: Number(row.disbursedAmount || 0),
    totalPayrollDeduction: Number(row.totalPayrollDeduction || 0),
  };
}

export async function getEwaRequestsList(
  db: Db,
  options: {
    employeeId?: string;
    periodMonth?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ data: EWARequest[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (options.employeeId) {
    conditions.push("r.employee_id = ?");
    params.push(options.employeeId);
  }
  if (options.periodMonth) {
    conditions.push("r.period_month = ?");
    params.push(options.periodMonth);
  }
  if (options.status) {
    conditions.push("r.status = ?");
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRes = await db
    .query(`SELECT COUNT(*) as count FROM ewa_requests r ${whereClause}`)
    .get<any>(...params);
  const total = Number(totalRes?.count || 0);

  const rows = await db
    .query(
      `SELECT 
        r.id, r.employee_id as "employeeId", e.name as "employeeName", e.nip as "employeeNip",
        e.is_member as "isMember", r.period_month as "periodMonth", r.salary_basis as "salaryBasis",
        r.max_limit as "maxLimit", r.amount_requested as "amountRequested", r.fee_percentage as "feePercentage",
        r.fee_amount as "feeAmount", r.disbursed_amount as "disbursedAmount", r.total_payroll_deduction as "totalPayrollDeduction",
        r.destination_bank as "destinationBank", r.destination_account as "destinationAccount", r.destination_name as "destinationName",
        r.status, r.rejection_reason as "rejectionReason", r.disbursed_at as "disbursedAt", r.disbursed_by as "disbursedBy",
        r.settled_at as "settledAt", r.created_at as "createdAt"
       FROM ewa_requests r
       JOIN company_employees e ON r.employee_id = e.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return {
    data: rows.map((r: any) => ({
      ...r,
      salaryBasis: Number(r.salaryBasis || 0),
      maxLimit: Number(r.maxLimit || 0),
      amountRequested: Number(r.amountRequested || 0),
      feePercentage: Number(r.feePercentage || 0),
      feeAmount: Number(r.feeAmount || 0),
      disbursedAmount: Number(r.disbursedAmount || 0),
      totalPayrollDeduction: Number(r.totalPayrollDeduction || 0),
    })),
    total,
    page,
    limit,
  };
}

export async function getPayrollRecap(
  db: Db,
  periodMonth: string
): Promise<{
  periodMonth: string;
  totalEmployees: number;
  totalDisbursed: number;
  totalFee: number;
  totalDeduction: number;
  isFullySettled: boolean;
  items: Array<{
    employeeId: string;
    nip: string;
    name: string;
    department?: string | null;
    isMember: boolean;
    totalAdvances: number;
    totalFee: number;
    totalDeduction: number;
    status: string;
  }>;
}> {
  const rows = await db
    .query(
      `SELECT 
        e.id as "employeeId", e.nip, e.name, e.department, e.is_member as "isMember",
        SUM(r.amount_requested) as "totalAdvances",
        SUM(r.fee_amount) as "totalFee",
        SUM(r.total_payroll_deduction) as "totalDeduction",
        MIN(r.status) as "status"
       FROM ewa_requests r
       JOIN company_employees e ON r.employee_id = e.id
       WHERE r.period_month = ? AND r.status IN ('DISBURSED', 'PAID_SETTLED')
       GROUP BY e.id, e.nip, e.name, e.department, e.is_member
       ORDER BY e.name ASC`
    )
    .all(periodMonth);

  const items = rows.map((r: any) => ({
    employeeId: r.employeeId,
    nip: r.nip,
    name: r.name,
    department: r.department,
    isMember: Boolean(r.isMember),
    totalAdvances: Number(r.totalAdvances || 0),
    totalFee: Number(r.totalFee || 0),
    totalDeduction: Number(r.totalDeduction || 0),
    status: r.status,
  }));

  const totalEmployees = items.length;
  const totalDisbursed = items.reduce((sum, item) => sum + item.totalAdvances, 0);
  const totalFee = items.reduce((sum, item) => sum + item.totalFee, 0);
  const totalDeduction = items.reduce((sum, item) => sum + item.totalDeduction, 0);

  const unsettledCount = await db
    .query(
      `SELECT COUNT(*) as count FROM ewa_requests WHERE period_month = ? AND status = 'DISBURSED'`
    )
    .get<any>(periodMonth);

  const isFullySettled = Number(unsettledCount?.count || 0) === 0 && totalEmployees > 0;

  return {
    periodMonth,
    totalEmployees,
    totalDisbursed,
    totalFee,
    totalDeduction,
    isFullySettled,
    items,
  };
}

export async function settlePayroll(
  db: Db,
  periodMonth: string,
  adminId?: string,
  targetAccountId?: string
): Promise<{ settledCount: number; totalSettledAmount: number }> {
  const recap = await getPayrollRecap(db, periodMonth);
  if (recap.totalEmployees === 0) {
    throw new ServiceError(`Tidak ada potongan EWA untuk periode ${periodMonth}`, 400);
  }

  // Find target cash/bank account for receiving payroll payment from parent company
  let bankAccountId = targetAccountId;
  if (!bankAccountId) {
    const bankAcc = await db.query("SELECT id FROM accounts WHERE code = '11102' LIMIT 1").get<{ id: string }>();
    bankAccountId = bankAcc?.id;
  }
  const payrollReceivableAcc = await db
    .query("SELECT id FROM accounts WHERE code = '11301' LIMIT 1")
    .get<{ id: string }>();

  let journalEntryId: string | null = null;
  const totalAmount = recap.totalDeduction;

  if (bankAccountId && payrollReceivableAcc?.id && totalAmount > 0) {
    journalEntryId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];

    // Verify valid admin ID in admins table
    let validAdminId: string | null = null;
    if (adminId) {
      const adminRow = await db.query("SELECT id FROM admins WHERE id = ?").get<{ id: string }>(adminId);
      if (adminRow?.id) {
        validAdminId = adminRow.id;
      } else {
        const firstAdmin = await db.query("SELECT id FROM admins LIMIT 1").get<{ id: string }>();
        validAdminId = firstAdmin?.id || null;
      }
    }

    await db.query(
      `INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by, created_at)
       VALUES (?, ?, ?, 'ewa_payroll_settlement', ?, ?, NOW())`
    ).run(
      journalEntryId,
      today,
      `Pelunasan Payroll Potong Gaji EWA Periode ${periodMonth} (${recap.totalEmployees} Karyawan)`,
      periodMonth,
      validAdminId
    );

    // Dr. Kas / Bank (penerimaan uang pelunasan dari holding company)
    await db.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).run(
      crypto.randomUUID(),
      journalEntryId,
      bankAccountId,
      totalAmount,
      `Penerimaan Pelunasan Payroll EWA Periode ${periodMonth}`
    );

    // Cr. Piutang Potong Gaji (Payroll)
    await db.query(
      `INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, 0, ?, ?)`
    ).run(
      crypto.randomUUID(),
      journalEntryId,
      payrollReceivableAcc.id,
      totalAmount,
      `Pelunasan Piutang Payroll EWA Periode ${periodMonth}`
    );
  }

  // Update all DISBURSED requests in period to PAID_SETTLED
  const updateRes = await db.query(
    `UPDATE ewa_requests 
     SET status = 'PAID_SETTLED', settled_at = NOW(), updated_at = NOW() 
     WHERE period_month = ? AND status = 'DISBURSED'`
  ).run(periodMonth);

  return {
    settledCount: recap.totalEmployees,
    totalSettledAmount: totalAmount,
  };
}

/**
 * Resolves and caps the base salary for EWA.
 * If EWA_MAX_BASE_SALARY environment variable is set (e.g. 10000000),
 * base salary will be capped at that value so that very high salaries are not disclosed to cooperative admins.
 */
export function getCappedBaseSalary(salary: number): number {
  const maxEnv =
    process.env.EWA_MAX_BASE_SALARY ||
    (typeof Bun !== "undefined" ? Bun.env.EWA_MAX_BASE_SALARY : undefined) ||
    process.env.VITE_EWA_MAX_BASE_SALARY ||
    (typeof Bun !== "undefined" ? Bun.env.VITE_EWA_MAX_BASE_SALARY : undefined);

  const numSalary = Math.max(0, Number(salary) || 0);
  if (maxEnv) {
    const cap = parseFloat(maxEnv);
    if (!isNaN(cap) && cap > 0) {
      return Math.min(numSalary, cap);
    }
  }
  return numSalary;
}

export async function batchImportEmployees(
  db: Db,
  items: Array<{
    nip: string;
    nik?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    department?: string | null;
    position?: string | null;
    baseSalary: number;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    contractEndDate?: string | null;
  }>
): Promise<{ processedCount: number; errors: Array<{ index: number; nip: string; message: string }> }> {
  let processedCount = 0;
  const errors: Array<{ index: number; nip: string; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const email = item.email.trim().toLowerCase();
      const nip = item.nip.trim();
      const name = item.name.trim();
      const cappedSalary = getCappedBaseSalary(item.baseSalary);
      const contractEndDate = item.contractEndDate ? item.contractEndDate.trim().slice(0, 10) : null;

      // Check if employee already exists by NIP or email
      const existing = await db
        .query("SELECT id FROM company_employees WHERE nip = ? OR LOWER(email) = ? LIMIT 1")
        .get<{ id: string }>(nip, email);

      if (existing) {
        await db.query(
          `UPDATE company_employees SET
            nik = ?, name = ?, email = ?, phone = ?, department = ?, position = ?,
            base_salary = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?,
            contract_end_date = ?, updated_at = NOW()
           WHERE id = ?`
        ).run(
          item.nik || null,
          name,
          email,
          item.phone || null,
          item.department || null,
          item.position || null,
          cappedSalary,
          item.bankName || null,
          item.bankAccountNumber || null,
          item.bankAccountName || name,
          contractEndDate,
          existing.id
        );
        await syncEmployeeMemberStatus(db, existing.id);
      } else {
        const id = crypto.randomUUID();
        await db.query(
          `INSERT INTO company_employees (
            id, nip, nik, name, email, phone, department, position,
            base_salary, bank_name, bank_account_number, bank_account_name,
            contract_end_date, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`
        ).run(
          id,
          nip,
          item.nik || null,
          name,
          email,
          item.phone || null,
          item.department || null,
          item.position || null,
          cappedSalary,
          item.bankName || null,
          item.bankAccountNumber || null,
          item.bankAccountName || name,
          contractEndDate
        );
        await syncEmployeeMemberStatus(db, id);
      }
      processedCount++;
    } catch (err: any) {
      errors.push({
        index: i,
        nip: item.nip || `Baris ${i + 1}`,
        message: err.message || "Gagal memproses data karyawan",
      });
    }
  }

  return { processedCount, errors };
}
