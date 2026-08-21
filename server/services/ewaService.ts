import type { Db } from "../db";
import { ServiceError } from "./errors";
import type { CompanyEmployee, EWARequest, EwaQuotaInfo } from "../../shared/types";

export const EWA_MAX_PERCENTAGE = 50; // 50% from monthly base salary
export const EWA_MEMBER_FEE_PCT = 2.0; // 2.0% for Cooperative Members
export const EWA_NON_MEMBER_FEE_PCT = 3.5; // 3.5% for Non-Members

function getCurrentPeriodMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

export async function getEmployeeByEmail(db: Db, email: string): Promise<CompanyEmployee | null> {
  const normEmail = email.trim().toLowerCase();
  const row = await db
    .query(
      `SELECT 
        id, nip, nik, name, email, phone, department, position,
        base_salary as "baseSalary", member_id as "memberId", is_member as "isMember",
        bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_account_name as "bankAccountName",
        status, created_at as "createdAt", updated_at as "updatedAt"
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
        status, created_at as "createdAt", updated_at as "updatedAt"
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
        status, created_at as "createdAt", updated_at as "updatedAt"
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

export async function getEmployeeEwaQuota(db: Db, employeeId: string, periodMonth?: string): Promise<EwaQuotaInfo> {
  const emp = await getEmployeeById(db, employeeId);
  if (!emp) {
    throw new ServiceError("Data karyawan tidak ditemukan", 404);
  }

  const period = periodMonth || getCurrentPeriodMonth();
  const maxMonthlyLimit = Math.floor((emp.baseSalary * EWA_MAX_PERCENTAGE) / 100);

  // Sum used advances in this period (PENDING, APPROVED, DISBURSED)
  const usedRes = await db
    .query(
      `SELECT COALESCE(SUM(amount_requested), 0) as used
       FROM ewa_requests
       WHERE employee_id = ? AND period_month = ? AND status IN ('PENDING', 'APPROVED', 'DISBURSED')`
    )
    .get<{ used: string | number }>(employeeId, period);

  const totalUsedThisMonth = Number(usedRes?.used || 0);
  const remainingQuota = Math.max(0, maxMonthlyLimit - totalUsedThisMonth);
  const feePercentage = emp.isMember ? EWA_MEMBER_FEE_PCT : EWA_NON_MEMBER_FEE_PCT;

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    isMember: emp.isMember,
    periodMonth: period,
    baseSalary: emp.baseSalary,
    maxAllowedPercentage: EWA_MAX_PERCENTAGE,
    maxMonthlyLimit,
    totalUsedThisMonth,
    remainingQuota,
    feePercentage,
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
  const quota = await getEmployeeEwaQuota(db, employeeId);
  const requestedAmount = Math.round(Number(input.amount));

  if (requestedAmount <= 0) {
    throw new ServiceError("Nominal penarikan harus lebih dari 0", 400);
  }

  if (requestedAmount > quota.remainingQuota) {
    throw new ServiceError(
      `Nominal penarikan (Rp ${requestedAmount.toLocaleString("id-ID")}) melebihi sisa kuota bulan ini (Rp ${quota.remainingQuota.toLocaleString("id-ID")})`,
      400
    );
  }

  const emp = await getEmployeeById(db, employeeId);
  const destBank = input.destinationBank || emp?.bankName || "Bank Mandiri";
  const destAcc = input.destinationAccount || emp?.bankAccountNumber || "-";
  const destName = input.destinationName || emp?.bankAccountName || emp?.name || "-";

  const feePercentage = quota.feePercentage;
  const feeAmount = Math.round((requestedAmount * feePercentage) / 100);
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
    quota.baseSalary,
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
  adminId: string,
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
  // Cr. Bank/Kas Account (11102 / 11101) = disbursed_amount
  // Cr. 41201 Pendapatan Administrasi EWA = fee_amount
  let sourceAccountId = paymentSourceAccountId;
  if (!sourceAccountId) {
    const bankAcc = await db.query("SELECT id FROM accounts WHERE code = '11102' LIMIT 1").get<{ id: string }>();
    sourceAccountId = bankAcc?.id;
  }

  const payrollReceivableAcc = await db
    .query("SELECT id FROM accounts WHERE code = '11301' LIMIT 1")
    .get<{ id: string }>();
  const ewaRevenueAcc = await db
    .query("SELECT id FROM accounts WHERE code = '41201' LIMIT 1")
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

export async function rejectEwa(db: Db, requestId: string, adminId: string, reason: string): Promise<EWARequest> {
  const req = await db.query("SELECT id, status FROM ewa_requests WHERE id = ?").get<{ id: string; status: string }>(requestId);
  if (!req) throw new ServiceError("Permohonan EWA tidak ditemukan", 404);
  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw new ServiceError(`Tidak dapat menolak EWA dengan status ${req.status}`, 400);
  }

  await db.query(
    `UPDATE ewa_requests SET status = 'REJECTED', rejection_reason = ?, updated_at = NOW() WHERE id = ?`
  ).run(reason, requestId);

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
  adminId: string,
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

      // Check if employee already exists by NIP or email
      const existing = await db
        .query("SELECT id FROM company_employees WHERE nip = ? OR LOWER(email) = ? LIMIT 1")
        .get<{ id: string }>(nip, email);

      if (existing) {
        await db.query(
          `UPDATE company_employees SET
            nik = ?, name = ?, email = ?, phone = ?, department = ?, position = ?,
            base_salary = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?,
            updated_at = NOW()
           WHERE id = ?`
        ).run(
          item.nik || null,
          name,
          email,
          item.phone || null,
          item.department || null,
          item.position || null,
          Number(item.baseSalary || 0),
          item.bankName || null,
          item.bankAccountNumber || null,
          item.bankAccountName || name,
          existing.id
        );
        await syncEmployeeMemberStatus(db, existing.id);
      } else {
        const id = crypto.randomUUID();
        await db.query(
          `INSERT INTO company_employees (
            id, nip, nik, name, email, phone, department, position,
            base_salary, bank_name, bank_account_number, bank_account_name, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`
        ).run(
          id,
          nip,
          item.nik || null,
          name,
          email,
          item.phone || null,
          item.department || null,
          item.position || null,
          Number(item.baseSalary || 0),
          item.bankName || null,
          item.bankAccountNumber || null,
          item.bankAccountName || name
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
