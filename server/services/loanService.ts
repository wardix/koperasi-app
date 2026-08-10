import type { Db } from "../db";
import type { LoanRow, LoanScheduleRow } from "../db/entities";
import { addMonthsYmd, resolveCalendarDateIso } from "../lib/dates";
import { ServiceError } from "./errors";
import { recordAutoJournal } from "./accountingService";

export function calculateLoanInterest(amount: number, tenor: string | number, bungaRate: number) {
  const tenorMonths = Math.max(1, parseInt(String(tenor)) || 1);

  if (bungaRate <= 0) {
    return {
      interestAmount: 0,
      totalAmount: amount,
      monthlyPayment: Math.ceil(amount / tenorMonths),
    };
  }

  const i = bungaRate / 1200;
  const power = Math.pow(1 + i, tenorMonths);
  const monthlyPayment = (amount * (i * power)) / (power - 1);

  const roundedMonthlyPayment = Math.ceil(monthlyPayment);
  const totalAmount = roundedMonthlyPayment * tenorMonths;
  const interestAmount = totalAmount - amount;

  return {
    interestAmount,
    totalAmount,
    monthlyPayment: roundedMonthlyPayment,
  };
}

export type AmortizationRow = {
  installmentNo: number;
  principalAmount: number;
  interestAmount: number;
};

/**
 * Classical declining-balance (annuity) schedule:
 * - fixed monthly installment (principal + interest ≈ monthlyPayment)
 * - early periods: higher interest, lower principal
 * - later periods: lower interest, higher principal
 * - sum of principalAmount === original principal
 */
export function buildAmortizationSchedule(
  principal: number,
  tenor: string | number,
  annualRatePercent: number
): { monthlyPayment: number; totalAmount: number; interestAmount: number; rows: AmortizationRow[] } {
  const tenorMonths = Math.max(1, parseInt(String(tenor)) || 1);
  const amount = Math.max(0, Math.round(Number(principal) || 0));
  const { monthlyPayment, totalAmount, interestAmount } = calculateLoanInterest(
    amount,
    tenorMonths,
    annualRatePercent
  );

  const monthlyRate = annualRatePercent > 0 ? annualRatePercent / 1200 : 0;
  let balance = amount;
  const rows: AmortizationRow[] = [];

  for (let month = 1; month <= tenorMonths; month++) {
    const interestPart =
      monthlyRate > 0 && balance > 0 ? Math.round(balance * monthlyRate) : 0;

    let principalPart: number;
    if (month === tenorMonths) {
      // Final installment clears remaining principal (handles rounding drift)
      principalPart = balance;
    } else if (monthlyRate <= 0) {
      principalPart = Math.floor(amount / tenorMonths);
    } else {
      principalPart = monthlyPayment - interestPart;
      if (principalPart < 0) principalPart = 0;
      if (principalPart > balance) principalPart = balance;
    }

    rows.push({
      installmentNo: month,
      principalAmount: principalPart,
      interestAmount: interestPart,
    });
    balance -= principalPart;
  }

  // Safety: if rounding left a residual (should be 0), fold into last principal
  if (balance !== 0 && rows.length > 0) {
    const last = rows[rows.length - 1];
    last.principalAmount += balance;
    balance = 0;
  }

  return { monthlyPayment, totalAmount, interestAmount, rows };
}

export type CreateLoanInput = {
  memberId: string;
  name: string;
  amount: number;
  tenor: number;
  purpose: string;
  status: string;
  /** Optional backdated loan date as YYYY-MM-DD */
  loanDate?: string;
};

export async function createLoan(database: Db, input: CreateLoanInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const createdAt = resolveCalendarDateIso(input.loanDate);

  const insert = database.prepare(`
    INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insert.run(
    id,
    input.memberId,
    input.name,
    input.amount,
    input.tenor,
    input.purpose,
    input.status,
    createdAt
  );

  return { id };
}

export async function getBungaRatePercent(database: Db): Promise<number> {
  const bungaSetting = await database
    .query("SELECT value FROM settings WHERE key = 'bungaPinjaman'")
    .get<{ value: string }>();
  return parseFloat(bungaSetting?.value || "0");
}

export async function resolveLoanTotalAmount(database: Db, loan: LoanRow): Promise<number> {
  if (loan.approvedAt && loan.totalAmount !== null) {
    return Number(loan.totalAmount);
  }

  const bungaRate = await getBungaRatePercent(database);
  return calculateLoanInterest(loan.amount, loan.tenor, bungaRate).totalAmount;
}

export function enrichLoanForList(loan: LoanRow & { paidAmount?: number }, bungaRate: number) {
  if (loan.approvedAt && loan.totalAmount !== null) {
    return {
      ...loan,
      interestAmount: loan.interestAmount,
      totalAmount: loan.totalAmount,
    };
  }

  const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);
  return {
    ...loan,
    interestAmount,
    totalAmount,
  };
}

/**
 * Write (or replace) installment rows for a loan using annuity amortization.
 * Does not touch loan_payments; call rebuildLoanPaymentAllocations after replace.
 */
async function writeInstallmentSchedule(
  database: Db,
  loan: { id: string; amount: number; tenor: string | number; createdAt?: string | null },
  bungaRatePercent: number,
  options?: { replaceExisting?: boolean }
): Promise<ReturnType<typeof buildAmortizationSchedule>> {
  const schedule = buildAmortizationSchedule(loan.amount, loan.tenor, bungaRatePercent);
  const tenorMonths = schedule.rows.length;

  await database.run(
    `UPDATE loans SET interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ? WHERE id = ?`,
    [bungaRatePercent, schedule.monthlyPayment, schedule.totalAmount, schedule.interestAmount, loan.id]
  );

  if (options?.replaceExisting) {
    await database.run(`DELETE FROM loan_schedules WHERE loanId = ?`, [loan.id]);
  }

  // Base schedule on loan createdAt so backdated loans get historical due dates
  let baseDate = loan.createdAt ? new Date(loan.createdAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  for (const row of schedule.rows) {
    const dueDate = addMonthsYmd(baseDate, row.installmentNo);

    await database.run(
      `
      INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
      ON CONFLICT (loanId, installmentNo) DO NOTHING
    `,
      [
        `${loan.id}-${row.installmentNo}`,
        loan.id,
        row.installmentNo,
        dueDate,
        row.principalAmount,
        row.interestAmount,
      ]
    );
  }

  await database.run(`UPDATE loans SET scheduleGenerated = TRUE, totalInstallments = ? WHERE id = ?`, [
    tenorMonths,
    loan.id,
  ]);

  return schedule;
}

async function generateInstallmentSchedule(
  database: Db,
  loan: { id: string; amount: number; tenor: string | number; createdAt?: string | null },
  bungaRatePercent: number,
  _interestAmount: number,
  _totalAmount: number
): Promise<void> {
  await writeInstallmentSchedule(database, loan, bungaRatePercent);
}

export type ScheduleRowInput = {
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
};

function assertEditableApprovedLoan(loan: LoanRow | null): asserts loan is LoanRow {
  if (!loan || loan.deletedAt) {
    throw new ServiceError("Loan not found", 404);
  }
  if (loan.status !== "Disetujui" && loan.status !== "Lunas" && loan.status !== "Macet") {
    throw new ServiceError("Jadwal hanya bisa diubah untuk pinjaman yang sudah disetujui", 400);
  }
}

export async function getLoanSchedule(
  database: Db,
  loanId: string
): Promise<LoanScheduleRow[]> {
  const loan = await database.query("SELECT id FROM loans WHERE id = ? AND deletedAt IS NULL").get(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }
  return database
    .query(
      `SELECT id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status, lateFee, paidAt
       FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC`
    )
    .all<LoanScheduleRow>(loanId);
}

/**
 * Rebuild schedule with annuity formula.
 * Preserves loan_payments and re-allocates them onto the new schedule.
 * @param options.interestRate — override rate (% p.a.); else uses loan snapshot / global setting
 */
export async function regenerateLoanInstallmentSchedule(
  database: Db,
  loanId: string,
  options?: { interestRate?: number }
): Promise<{ rows: number; monthlyPayment: number; interestRate: number; totalAmount: number }> {
  return database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
    assertEditableApprovedLoan(loan);

    let bungaRatePercent: number;
    if (options?.interestRate != null && Number.isFinite(options.interestRate)) {
      bungaRatePercent = Number(options.interestRate);
    } else {
      const snapRate = loan.interestRate != null ? Number(loan.interestRate) : NaN;
      bungaRatePercent = Number.isFinite(snapRate)
        ? snapRate
        : await getBungaRatePercent(database);
    }

    // Prefer disbursement/approval date for due-date base
    const baseIso = loan.approvedAt || loan.createdAt;
    const schedule = await writeInstallmentSchedule(
      database,
      {
        id: loan.id,
        amount: Number(loan.amount),
        tenor: loan.tenor,
        createdAt: baseIso,
      },
      bungaRatePercent,
      { replaceExisting: true }
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    return {
      rows: schedule.rows.length,
      monthlyPayment: schedule.monthlyPayment,
      interestRate: bungaRatePercent,
      totalAmount: schedule.totalAmount,
    };
  })();
}

/**
 * Replace installment schedule with manually provided rows.
 * Sum of principalAmount must equal loan principal. Re-allocates existing payments.
 */
export async function replaceLoanInstallmentSchedule(
  database: Db,
  loanId: string,
  rows: ScheduleRowInput[]
): Promise<{ rows: number; totalAmount: number; interestAmount: number }> {
  return database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
    assertEditableApprovedLoan(loan);

    if (!rows.length) {
      throw new ServiceError("Jadwal angsuran tidak boleh kosong", 400);
    }

    const sorted = [...rows].sort((a, b) => a.installmentNo - b.installmentNo);
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      if (row.installmentNo !== i + 1) {
        throw new ServiceError(`Nomor cicilan harus berurutan 1…${sorted.length}`, 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) {
        throw new ServiceError(`Format tanggal cicilan #${row.installmentNo} harus YYYY-MM-DD`, 400);
      }
      if (!Number.isFinite(row.principalAmount) || row.principalAmount < 0) {
        throw new ServiceError(`Pokok cicilan #${row.installmentNo} tidak valid`, 400);
      }
      if (!Number.isFinite(row.interestAmount) || row.interestAmount < 0) {
        throw new ServiceError(`Biaya admin cicilan #${row.installmentNo} tidak valid`, 400);
      }
    }

    const sumPrincipal = sorted.reduce((s, r) => s + Math.round(r.principalAmount), 0);
    const principal = Math.round(Number(loan.amount));
    if (sumPrincipal !== principal) {
      throw new ServiceError(
        `Jumlah pokok jadwal (${sumPrincipal}) harus sama dengan plafon pinjaman (${principal})`,
        400
      );
    }

    const sumInterest = sorted.reduce((s, r) => s + Math.round(r.interestAmount), 0);
    const totalAmount = sumPrincipal + sumInterest;
    const tenorMonths = sorted.length;
    const monthlyPayment = Math.ceil(totalAmount / tenorMonths);

    await database.run(`DELETE FROM loan_schedules WHERE loanId = ?`, [loanId]);

    for (const row of sorted) {
      await database.run(
        `
        INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
      `,
        [
          `${loanId}-${row.installmentNo}`,
          loanId,
          row.installmentNo,
          row.dueDate,
          Math.round(row.principalAmount),
          Math.round(row.interestAmount),
        ]
      );
    }

    // Keep interestRate snapshot as-is (manual edit may diverge from rate formula)
    await database.run(
      `UPDATE loans SET monthlyPayment = ?, totalAmount = ?, interestAmount = ?,
         scheduleGenerated = TRUE, totalInstallments = ?, tenor = ?
       WHERE id = ?`,
      [monthlyPayment, totalAmount, sumInterest, tenorMonths, tenorMonths, loanId]
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    return { rows: tenorMonths, totalAmount, interestAmount: sumInterest };
  })();
}

/**
 * Regenerate schedules for all active approved/outstanding/paid-off loans.
 * Skips soft-deleted and pending/rejected applications.
 */
export async function regenerateAllLoanInstallmentSchedules(
  database: Db
): Promise<{ processed: number; loanIds: string[] }> {
  const loans = await database
    .query(
      `SELECT id FROM loans
       WHERE deletedAt IS NULL
         AND status IN ('Disetujui', 'Lunas', 'Macet')
       ORDER BY id ASC`
    )
    .all<{ id: string }>();

  const loanIds: string[] = [];
  for (const row of loans) {
    await regenerateLoanInstallmentSchedule(database, row.id);
    loanIds.push(row.id);
  }

  return { processed: loanIds.length, loanIds };
}

export type UpdateLoanStatusOptions = {
  /** YYYY-MM-DD disbursement date; defaults to loan createdAt then today */
  approvedDate?: string;
  /**
   * Per-loan admin fee / interest (% p.a.). When set on approve, overrides global
   * bungaPinjaman for schedule generation and is snapshotted on the loan row.
   */
  interestRate?: number;
};

export async function updateLoanStatus(
  database: Db,
  loanId: string,
  status: string,
  options?: UpdateLoanStatusOptions
): Promise<{ before: Pick<LoanRow, "status" | "memberId"> | null }> {
  if (status === "Disetujui") {
    await database.transaction(async () => {
      const loan = (await database
        .query(`
          SELECT l.id, l.amount, l.tenor, l.scheduleGenerated, l.createdAt,
                 COALESCE(m.name, l.name) as borrower_name
          FROM loans l
          LEFT JOIN members m ON l.memberId = m.id
          WHERE l.id = ?
        `)
        .get(loanId)) as {
        id: string;
        amount: number;
        tenor: string;
        scheduleGenerated: boolean;
        createdAt: string | null;
        borrower_name: string;
      } | null;

      // Prefer explicit approvedDate (from approve UI), else loan application date, else now.
      // Also align createdAt so cashflow/LoansTx (pencairan) show the historical date.
      let approvedAt: string;
      if (options?.approvedDate) {
        approvedAt = resolveCalendarDateIso(options.approvedDate);
      } else if (loan?.createdAt) {
        const parsed = new Date(loan.createdAt);
        approvedAt = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      } else {
        approvedAt = new Date().toISOString();
      }

      const stmt = database.prepare(
        `UPDATE loans SET status = ?, approvedAt = ?, createdAt = ? WHERE id = ?`
      );
      await stmt.run(status, approvedAt, approvedAt, loanId);

      const globalRate = await getBungaRatePercent(database);
      const bungaRatePercent =
        options?.interestRate != null && Number.isFinite(options.interestRate)
          ? Number(options.interestRate)
          : globalRate;

      if (loan && !loan.scheduleGenerated) {
        const loanForSchedule = { ...loan, createdAt: approvedAt, amount: Number(loan.amount) };
        const { interestAmount, totalAmount } = calculateLoanInterest(
          loanForSchedule.amount,
          loan.tenor,
          bungaRatePercent
        );
        await generateInstallmentSchedule(database, loanForSchedule, bungaRatePercent, interestAmount, totalAmount);
      }

      if (loan) {
        try {
          await recordAutoJournal({
            transaction_date: approvedAt,
            description: `Pencairan Pinjaman Anggota — ${loan.borrower_name}`,
            reference_type: 'loan_disbursement',
            reference_id: loanId,
            lines: [
              { account_code: '1210', debit: loan.amount }, // Piutang
              { account_code: '1120', credit: loan.amount } // Kas Keluar
            ]
          });
        } catch (err) {
          console.error("Gagal auto-journal pencairan pinjaman:", err);
        }
      }
    })();
  } else {
    const stmt = database.prepare(`UPDATE loans SET status = ? WHERE id = ?`);
    await stmt.run(status, loanId);
  }

  const before = await database
    .query("SELECT status, memberId FROM loans WHERE id = ?")
    .get<Pick<LoanRow, "status" | "memberId">>(loanId);

  return { before };
}

export type RecordPaymentInput = {
  amount: number;
  method: string;
  /** Optional backdated payment date as YYYY-MM-DD */
  paymentDate?: string;
};

export type UpdatePaymentInput = {
  amount?: number;
  method?: string;
  /** Optional backdated payment date as YYYY-MM-DD */
  paymentDate?: string;
};

type PaymentRow = {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method: string;
};

/**
 * Reset schedule allocations and re-apply all payments in chronological order.
 * Keeps loan_payments rows as source of truth after edit/delete.
 */
async function rebuildLoanPaymentAllocations(database: Db, loanId: string): Promise<void> {
  const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  // Reset schedules
  await database.run(
    `UPDATE loan_schedules
     SET paidAmount = 0, status = 'Pending', updatedAt = CURRENT_TIMESTAMP
     WHERE loanId = ?`,
    [loanId]
  );

  // Reset loan status away from Lunas/Macet while rebuilding (unless no schedule and unpaid)
  if (loan.status === "Lunas" || loan.status === "Macet") {
    await database.run(`UPDATE loans SET status = 'Disetujui', paidInstallments = 0 WHERE id = ?`, [loanId]);
  } else {
    await database.run(`UPDATE loans SET paidInstallments = 0 WHERE id = ?`, [loanId]);
  }

  const payments = await database
    .query(
      `SELECT id, loanId, amount, paymentDate, method FROM loan_payments
       WHERE loanId = ?
       ORDER BY paymentDate ASC, id ASC`
    )
    .all<PaymentRow>(loanId);

  const totalAmount = await resolveLoanTotalAmount(database, loan);
  let totalPaid = 0;

  for (const payment of payments) {
    totalPaid += Number(payment.amount);
    await allocatePaymentToSchedules(database, loanId, Number(payment.amount), payment.paymentDate);
  }

  const paidInstallmentCount = await database
    .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Paid'`)
    .get<{ count: number }>(loanId);
  await database.run(`UPDATE loans SET paidInstallments = ? WHERE id = ?`, [
    Number(paidInstallmentCount?.count || 0),
    loanId,
  ]);

  const scheduleCount = await database
    .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ?`)
    .get<{ count: number }>(loanId);

  if (Number(scheduleCount?.count || 0) > 0) {
    const remainingPending = await database
      .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status IN ('Pending', 'Late')`)
      .get<{ count: number }>(loanId);

    if (Number(remainingPending?.count || 0) === 0 && payments.length > 0) {
      await database.run(`UPDATE loans SET status = 'Lunas', paidInstallments = totalInstallments WHERE id = ?`, [
        loanId,
      ]);
    } else {
      // Mark overdue installments
      const now = new Date();
      const overdue = await database
        .query(
          `SELECT dueDate FROM loan_schedules
           WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE
           ORDER BY dueDate ASC LIMIT 1`
        )
        .get<{ dueDate: string }>(loanId);

      if (overdue?.dueDate) {
        const dpd = Math.floor(
          (now.getTime() - new Date(overdue.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dpd >= 90) {
          await database.run(`UPDATE loans SET status = 'Macet' WHERE id = ?`, [loanId]);
        }
        await database.run(
          `UPDATE loan_schedules SET status = 'Late', updatedAt = CURRENT_TIMESTAMP
           WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE`,
          [loanId]
        );
      } else if (loan.status === "Lunas" || loan.status === "Macet") {
        // already reset to Disetujui above when rebuilding
      } else if (payments.length > 0 && totalPaid < totalAmount) {
        await database.run(`UPDATE loans SET status = 'Disetujui' WHERE id = ? AND status = 'Lunas'`, [loanId]);
      }
    }
  } else if (totalPaid >= totalAmount && payments.length > 0) {
    await database.run(`UPDATE loans SET status = 'Lunas' WHERE id = ?`, [loanId]);
  } else if (loan.status === "Lunas" && totalPaid < totalAmount) {
    await database.run(`UPDATE loans SET status = 'Disetujui' WHERE id = ?`, [loanId]);
  }
}

async function allocatePaymentToSchedules(
  database: Db,
  loanId: string,
  amount: number,
  paymentDateIso: string
): Promise<void> {
  let allocatedAmount = amount;
  const schedules = await database
    .query(
      `SELECT * FROM loan_schedules
       WHERE loanId = ? AND status IN ('Pending', 'Late')
       ORDER BY installmentNo ASC`
    )
    .all<LoanScheduleRow>(loanId);

  if (schedules.length === 0) return;

  const asOf = new Date(paymentDateIso);
  const dendaSetting = await database
    .query("SELECT value FROM settings WHERE key = 'denda'")
    .get<{ value: string }>();
  const dendaPercent = parseFloat(dendaSetting?.value || "0");

  for (const schedule of schedules) {
    if (allocatedAmount <= 0) break;

    const dueDate = new Date(schedule.dueDate);
    const daysLate = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const lateFee =
      daysLate > 0 ? Math.round(Number(schedule.principalAmount) * (dendaPercent / 100)) : 0;

    const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + lateFee;
    const paymentForThisInstallment = Math.min(
      allocatedAmount,
      totalDue - Number(schedule.paidAmount || 0)
    );

    if (paymentForThisInstallment <= 0) continue;

    const newPaidAmount = Number(schedule.paidAmount || 0) + paymentForThisInstallment;
    const isFullyPaid = newPaidAmount >= totalDue;

    await database.run(
      `UPDATE loan_schedules SET paidAmount = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPaidAmount, isFullyPaid ? "Paid" : "Pending", schedule.id]
    );

    allocatedAmount -= paymentForThisInstallment;
  }
}

export async function recordLoanPayment(
  database: Db,
  loanId: string,
  input: RecordPaymentInput
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const paymentDate = resolveCalendarDateIso(input.paymentDate);

  await database.transaction(async () => {
    const loan = await database.query(`
      SELECT l.*, COALESCE(m.name, l.name) as borrower_name 
      FROM loans l
      LEFT JOIN members m ON l.memberId = m.id
      WHERE l.id = ? FOR UPDATE OF l
    `).get(loanId) as (LoanRow & { borrower_name: string }) | null;
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const totalAmount = await resolveLoanTotalAmount(database, loan);
    const paid = Number(
      (
        await database
          .query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?")
          .get<{ paid: number | null }>(loanId)
      )?.paid || 0
    );

    if (paid + input.amount > totalAmount) {
      throw new ServiceError("Total pembayaran melebihi jumlah pinjaman");
    }

    await database
      .prepare(
        `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, loanId, input.amount, paymentDate, input.method);

    await rebuildLoanPaymentAllocations(database, loanId);
    
    // Otomatisasi Jurnal
    try {
      const kasCode = input.method === 'Cash' ? '1110' : '1120';
      const principalRatio = Number(loan.amount) / totalAmount;
      const interestRatio = 1 - principalRatio;
      
      const principalPaid = Math.round(input.amount * principalRatio);
      const interestPaid = input.amount - principalPaid;

      await recordAutoJournal({
        transaction_date: paymentDate,
        description: `Pembayaran Cicilan Pinjaman — ${loan.borrower_name}`,
        reference_type: 'loan_payment',
        reference_id: id,
        lines: [
          { account_code: kasCode, debit: input.amount }, // Kas Masuk
          { account_code: '1210', credit: principalPaid }, // Piutang Berkurang
          { account_code: '4110', credit: interestPaid } // Pendapatan Bunga
        ]
      });
    } catch (err) {
      console.error("Gagal auto-journal pembayaran pinjaman:", err);
    }
  })();

  return { id };
}

export async function updateLoanPayment(
  database: Db,
  loanId: string,
  paymentId: string,
  input: UpdatePaymentInput
): Promise<{ before: PaymentRow; after: PaymentRow }> {
  let before: PaymentRow | null = null;
  let after: PaymentRow | null = null;

  await database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ? FOR UPDATE").get<LoanRow>(loanId);
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const existing = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ? AND loanId = ?")
      .get<PaymentRow>(paymentId, loanId);

    if (!existing) {
      throw new ServiceError("Pembayaran tidak ditemukan", 404);
    }
    before = existing;

    const nextAmount = input.amount != null ? Number(input.amount) : Number(existing.amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new ServiceError("Nominal pembayaran harus lebih dari 0", 400);
    }

    const nextMethod = input.method?.trim() || existing.method;
    const nextPaymentDate = input.paymentDate
      ? resolveCalendarDateIso(input.paymentDate)
      : existing.paymentDate;

    const totalAmount = await resolveLoanTotalAmount(database, loan);
    const otherPaid = Number(
      (
        await database
          .query(
            "SELECT COALESCE(SUM(amount), 0) as paid FROM loan_payments WHERE loanId = ? AND id != ?"
          )
          .get<{ paid: number }>(loanId, paymentId)
      )?.paid || 0
    );

    if (otherPaid + nextAmount > totalAmount) {
      throw new ServiceError("Total pembayaran melebihi jumlah pinjaman", 400);
    }

    await database.run(
      `UPDATE loan_payments SET amount = ?, paymentDate = ?, method = ? WHERE id = ? AND loanId = ?`,
      [nextAmount, nextPaymentDate, nextMethod, paymentId, loanId]
    );

    await rebuildLoanPaymentAllocations(database, loanId);

    after = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ?")
      .get<PaymentRow>(paymentId);
  })();

  if (!before || !after) {
    throw new ServiceError("Pembayaran tidak ditemukan", 404);
  }
  return { before, after };
}

export async function deleteLoanPayment(
  database: Db,
  loanId: string,
  paymentId: string
): Promise<{ before: PaymentRow }> {
  let before: PaymentRow | null = null;

  await database.transaction(async () => {
    const loan = await database.query("SELECT * FROM loans WHERE id = ? FOR UPDATE").get<LoanRow>(loanId);
    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }

    const existing = await database
      .query("SELECT id, loanId, amount, paymentDate, method FROM loan_payments WHERE id = ? AND loanId = ?")
      .get<PaymentRow>(paymentId, loanId);

    if (!existing) {
      throw new ServiceError("Pembayaran tidak ditemukan", 404);
    }
    before = existing;

    await database.run(`DELETE FROM loan_payments WHERE id = ? AND loanId = ?`, [paymentId, loanId]);
    await rebuildLoanPaymentAllocations(database, loanId);
  })();

  if (!before) {
    throw new ServiceError("Pembayaran tidak ditemukan", 404);
  }
  return { before };
}

/**
 * Update pencairan / disbursement date for an already-approved loan.
 * Aligns approvedAt + createdAt (cashflow / LoansTx) and shifts schedule due dates.
 */
export async function updateLoanDisbursementDate(
  database: Db,
  loanId: string,
  disbursementDate: string
): Promise<{ before: { approvedAt: string | null; createdAt: string | null }; after: { approvedAt: string; createdAt: string } }> {
  const iso = resolveCalendarDateIso(disbursementDate);
  let before: { approvedAt: string | null; createdAt: string | null } = {
    approvedAt: null,
    createdAt: null,
  };

  await database.transaction(async () => {
    const loan = await database
      .query(
        `SELECT id, status, approvedAt, createdAt, scheduleGenerated
         FROM loans WHERE id = ? AND deletedAt IS NULL FOR UPDATE`
      )
      .get<{
        id: string;
        status: string;
        approvedAt: string | null;
        createdAt: string | null;
        scheduleGenerated: boolean;
      }>(loanId);

    if (!loan) {
      throw new ServiceError("Loan not found", 404);
    }
    if (loan.status !== "Disetujui" && loan.status !== "Lunas" && loan.status !== "Macet") {
      throw new ServiceError("Hanya pinjaman yang sudah disetujui yang bisa diubah tanggal pencairannya", 400);
    }

    before = { approvedAt: loan.approvedAt, createdAt: loan.createdAt };

    await database.run(`UPDATE loans SET approvedAt = ?, createdAt = ? WHERE id = ?`, [
      iso,
      iso,
      loanId,
    ]);

    // Shift installment due dates from the new disbursement base
    const schedules = await database
      .query(
        `SELECT id, installmentNo FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC`
      )
      .all<{ id: string; installmentNo: number }>(loanId);

    if (schedules.length > 0) {
      const baseDate = new Date(iso);
      for (const row of schedules) {
        const due = addMonthsYmd(baseDate, Number(row.installmentNo));
        await database.run(`UPDATE loan_schedules SET dueDate = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [
          due,
          row.id,
        ]);
      }
      // Re-apply payments so Late/Lunas status stays consistent with new due dates
      await rebuildLoanPaymentAllocations(database, loanId);
    }
  })();

  return {
    before,
    after: { approvedAt: iso, createdAt: iso },
  };
}

export async function deleteLoan(database: Db, loanId: string): Promise<void> {
  const loan = await database
    .query("SELECT id, status FROM loans WHERE id = ? AND deletedAt IS NULL")
    .get<{ id: string; status: string }>(loanId);

  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  // Soft-delete: stamp deletedAt, keep all FK-referenced payment rows intact
  await database
    .query("UPDATE loans SET deletedAt = ? WHERE id = ?")
    .run(new Date().toISOString(), loanId);
}

// ---------------------------------------------------------------------------
// Batch Loan Import (CSV)
// ---------------------------------------------------------------------------

export type BatchLoanImportItem = {
  nik: string;
  nama_pinjaman: string;
  jumlah: number;
  tenor: number;
  tujuan: string;
  tanggal_pinjaman?: string | null;
  bunga?: number | null;
};

export type BatchLoanImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportLoans(
  database: Db,
  items: BatchLoanImportItem[]
): Promise<BatchLoanImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  const globalRate = await getBungaRatePercent(database);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = `NIK ${item.nik}`;

    try {
      // 1. Lookup member by NIK
      const cleanNik = String(item.nik).replace(/\D/g, "");
      const member = await database
        .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL LIMIT 1")
        .get<{ id: string }>(cleanNik);

      if (!member) {
        errors.push({ index: i, identifier, message: `Anggota dengan NIK ${item.nik} tidak ditemukan` });
        continue;
      }

      // 2. Create loan (status Menunggu first so we can approve)
      const { id: loanId } = await createLoan(database, {
        memberId: member.id,
        name: item.nama_pinjaman,
        amount: item.jumlah,
        tenor: item.tenor,
        purpose: item.tujuan,
        status: "Menunggu",
        loanDate: item.tanggal_pinjaman ?? undefined,
      });

      // 3. Approve loan → auto-generates schedule + auto-journal
      const bungaRate = item.bunga != null ? item.bunga : globalRate;
      await updateLoanStatus(database, loanId, "Disetujui", {
        approvedDate: item.tanggal_pinjaman ?? undefined,
        interestRate: bungaRate,
      });

      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses pinjaman";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}

// ---------------------------------------------------------------------------
// Batch Payment Import / Angsuran (CSV)
// ---------------------------------------------------------------------------

export type BatchPaymentImportItem = {
  nik: string;
  loan_id?: string | null;
  jumlah: number;
  metode: string;
  tanggal?: string | null;
};

export type BatchPaymentImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ index: number; identifier: string; message: string }>;
};

export async function batchImportPayments(
  database: Db,
  items: BatchPaymentImportItem[]
): Promise<BatchPaymentImportResult> {
  let processedCount = 0;
  const errors: Array<{ index: number; identifier: string; message: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const identifier = `NIK ${item.nik}`;

    try {
      let loanId = item.loan_id || null;

      // If no explicit loan_id, look up via NIK
      if (!loanId) {
        const cleanNik = String(item.nik).replace(/\D/g, "");
        const member = await database
          .query("SELECT id FROM members WHERE nik = ? AND deletedAt IS NULL LIMIT 1")
          .get<{ id: string }>(cleanNik);

        if (!member) {
          errors.push({ index: i, identifier, message: `Anggota dengan NIK ${item.nik} tidak ditemukan` });
          continue;
        }

        // Find active loans
        const activeLoans = await database
          .query(`SELECT id FROM loans WHERE memberId = ? AND status = 'Disetujui' AND deletedAt IS NULL ORDER BY createdAt ASC`)
          .all<{ id: string }>(member.id);

        if (activeLoans.length === 0) {
          errors.push({ index: i, identifier, message: `Tidak ada pinjaman aktif untuk NIK ${item.nik}` });
          continue;
        }

        if (activeLoans.length > 1) {
          errors.push({
            index: i,
            identifier,
            message: `Anggota NIK ${item.nik} memiliki ${activeLoans.length} pinjaman aktif — gunakan kolom loan_id untuk menentukan pinjaman yang dituju`
          });
          continue;
        }

        loanId = activeLoans[0].id;
      }

      await recordLoanPayment(database, loanId, {
        amount: item.jumlah,
        method: item.metode,
        paymentDate: item.tanggal ?? undefined,
      });

      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses angsuran";
      errors.push({ index: i, identifier, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}

// ---------------------------------------------------------------------------
// Batch Schedule Import / Jadwal Angsuran (CSV)
// ---------------------------------------------------------------------------

export type BatchScheduleImportItem = {
  loan_id: string;
  cicilan_ke: number;
  tanggal_jatuh_tempo: string;
  pokok: number;
  bunga: number;
};

export type BatchScheduleImportResult = {
  processedCount: number;
  failedCount: number;
  errors: Array<{ identifier: string; message: string }>;
};

export async function batchImportSchedules(
  database: Db,
  items: BatchScheduleImportItem[]
): Promise<BatchScheduleImportResult> {
  let processedCount = 0;
  const errors: Array<{ identifier: string; message: string }> = [];

  // Group by loan_id
  const groups: Record<string, BatchScheduleImportItem[]> = {};
  for (const item of items) {
    if (!groups[item.loan_id]) {
      groups[item.loan_id] = [];
    }
    groups[item.loan_id].push(item);
  }

  for (const loanId of Object.keys(groups)) {
    const groupItems = groups[loanId];
    
    try {
      const loan = await database.query("SELECT * FROM loans WHERE id = ? AND deletedAt IS NULL").get<LoanRow>(loanId);
      if (!loan) {
        errors.push({ identifier: `Loan ${loanId}`, message: `Pinjaman dengan ID ${loanId} tidak ditemukan atau sudah dihapus` });
        continue;
      }

      const rows: ScheduleRowInput[] = groupItems.map((item) => ({
        installmentNo: item.cicilan_ke,
        dueDate: item.tanggal_jatuh_tempo,
        principalAmount: item.pokok,
        interestAmount: item.bunga,
      }));

      await replaceLoanInstallmentSchedule(database, loanId, rows);
      processedCount += rows.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses jadwal";
      errors.push({ identifier: `Loan ${loanId}`, message: msg });
    }
  }

  return { processedCount, failedCount: errors.length, errors };
}