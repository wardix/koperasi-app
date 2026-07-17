import type { Db } from "../db";
import type { LoanRow, LoanScheduleRow } from "../db/entities";
import { addMonthsYmd, resolveCalendarDateIso } from "../lib/dates";
import { ServiceError } from "./errors";

export function calculateLoanInterest(amount: number, tenor: string | number, bungaRate: number) {
  const tenorMonths = Math.max(1, parseInt(String(tenor)) || 1);

  if (bungaRate <= 0) {
    return {
      interestAmount: 0,
      totalAmount: amount,
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
  };
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

async function generateInstallmentSchedule(
  database: Db,
  loan: { id: string; amount: number; tenor: string | number; createdAt?: string | null },
  bungaRatePercent: number,
  interestAmount: number,
  totalAmount: number
): Promise<void> {
  const tenorMonths = parseInt(String(loan.tenor));
  const monthlyPayment = Math.ceil(totalAmount / tenorMonths);

  await database.run(
    `UPDATE loans SET interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ? WHERE id = ?`,
    [bungaRatePercent, monthlyPayment, totalAmount, interestAmount, loan.id]
  );

  const i = bungaRatePercent / 1200;
  // Base schedule on loan createdAt so backdated loans get historical due dates
  let baseDate = loan.createdAt ? new Date(loan.createdAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  for (let month = 1; month <= tenorMonths; month++) {
    const dueDate = addMonthsYmd(baseDate, month);

    const remainingPrincipal = loan.amount - (loan.amount * (month - 1)) / tenorMonths;
    const currentPrincipal = Math.floor(remainingPrincipal / (tenorMonths - month + 1));
    const currentInterest = Math.round((loan.amount - currentPrincipal * (tenorMonths - month + 1)) * i);

    await database.run(
      `
      INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
      ON CONFLICT (loanId, installmentNo) DO NOTHING
    `,
      [
        `${loan.id}-${month}`,
        loan.id,
        month,
        dueDate,
        currentPrincipal,
        currentInterest,
      ]
    );
  }

  await database.run(`UPDATE loans SET scheduleGenerated = TRUE, totalInstallments = ? WHERE id = ?`, [
    tenorMonths,
    loan.id,
  ]);
}

export type UpdateLoanStatusOptions = {
  /** YYYY-MM-DD disbursement date; defaults to loan createdAt then today */
  approvedDate?: string;
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
        .query("SELECT id, amount, tenor, scheduleGenerated, createdAt FROM loans WHERE id = ?")
        .get(loanId)) as {
        id: string;
        amount: number;
        tenor: string;
        scheduleGenerated: boolean;
        createdAt: string | null;
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

      const bungaRatePercent = await getBungaRatePercent(database);

      if (loan && !loan.scheduleGenerated) {
        const loanForSchedule = { ...loan, createdAt: approvedAt, amount: Number(loan.amount) };
        const { interestAmount, totalAmount } = calculateLoanInterest(
          loanForSchedule.amount,
          loan.tenor,
          bungaRatePercent
        );
        await generateInstallmentSchedule(database, loanForSchedule, bungaRatePercent, interestAmount, totalAmount);
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
    const loan = await database.query("SELECT * FROM loans WHERE id = ? FOR UPDATE").get<LoanRow>(loanId);
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