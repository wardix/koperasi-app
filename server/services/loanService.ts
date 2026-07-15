import type { Db } from "../db";
import type { LoanRow, LoanScheduleRow } from "../db/entities";
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
};

export async function createLoan(database: Db, input: CreateLoanInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

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
  loan: { id: string; amount: number; tenor: string | number },
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

  for (let month = 1; month <= tenorMonths; month++) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + month);

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
        dueDate.toISOString().split("T")[0],
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

export async function updateLoanStatus(
  database: Db,
  loanId: string,
  status: string
): Promise<{ before: Pick<LoanRow, "status" | "memberId"> | null }> {
  if (status === "Disetujui") {
    await database.transaction(async () => {
      const stmt = database.prepare(`UPDATE loans SET status = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ?`);
      await stmt.run(status, loanId);

      const bungaRatePercent = await getBungaRatePercent(database);
      const loan = (await database
        .query("SELECT id, amount, tenor, scheduleGenerated FROM loans WHERE id = ?")
        .get(loanId)) as { id: string; amount: number; tenor: string; scheduleGenerated: boolean } | null;

      if (loan && !loan.scheduleGenerated) {
        const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRatePercent);
        await generateInstallmentSchedule(database, loan, bungaRatePercent, interestAmount, totalAmount);
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
};

export async function recordLoanPayment(
  database: Db,
  loanId: string,
  input: RecordPaymentInput
): Promise<{ id: string }> {
  const loan = await database.query("SELECT * FROM loans WHERE id = ?").get<LoanRow>(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  const totalAmount = await resolveLoanTotalAmount(database, loan);
  const paid = Number(
    (await database.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get<{ paid: number | null }>(
      loanId
    ))?.paid || 0
  );

  if (paid + input.amount > totalAmount) {
    throw new ServiceError("Total pembayaran melebihi jumlah pinjaman");
  }

  const id = crypto.randomUUID();
  const paymentDate = new Date().toISOString();

  await database.transaction(async () => {
    const stmt = database.prepare(`
      INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
      VALUES (?, ?, ?, ?, ?)
    `);
    await stmt.run(id, loanId, input.amount, paymentDate, input.method);

    let allocatedAmount = input.amount;
    const pendingSchedules = await database
      .query(`
        SELECT * FROM loan_schedules
        WHERE loanId = ? AND status = 'Pending'
        ORDER BY installmentNo ASC
      `)
      .all<LoanScheduleRow>(loanId);

    if (pendingSchedules.length > 0) {
      const today = new Date();
      for (const schedule of pendingSchedules) {
        if (allocatedAmount <= 0) break;

        const dueDate = new Date(schedule.dueDate);
        const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        let lateFee = 0;
        if (daysLate > 0) {
          const dendaSetting = await database.query("SELECT value FROM settings WHERE key = 'denda'").get<{ value: string }>();
          const dendaPercent = parseFloat(dendaSetting?.value || "0");
          lateFee = Math.round(schedule.principalAmount * (dendaPercent / 100));
        }

        const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + lateFee;
        const paymentForThisInstallment = Math.min(allocatedAmount, totalDue - Number(schedule.paidAmount || 0));

        if (paymentForThisInstallment > 0) {
          const newPaidAmount = Number(schedule.paidAmount || 0) + paymentForThisInstallment;
          const isFullyPaid = newPaidAmount >= totalDue;

          await database.run(
            `UPDATE loan_schedules SET paidAmount = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
            [newPaidAmount, isFullyPaid ? "Paid" : "Pending", schedule.id]
          );

          allocatedAmount -= paymentForThisInstallment;

          if (isFullyPaid) {
            const remainingPending = await database
              .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Pending'`)
              .get<{ count: number }>(loanId);
            if (Number(remainingPending?.count || 0) === 0) {
              await database.run(`UPDATE loans SET status = 'Lunas', paidInstallments = totalInstallments WHERE id = ?`, [
                loanId,
              ]);
            }
          }
        }
      }

      const paidInstallmentCount = await database
        .query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Paid'`)
        .get<{ count: number }>(loanId);
      if (paidInstallmentCount && Number(paidInstallmentCount.count || 0) > 0) {
        await database.run(`UPDATE loans SET paidInstallments = ? WHERE id = ?`, [
          Number(paidInstallmentCount.count),
          loanId,
        ]);
      }

      const overdueSchedules = await database
        .query(`
          SELECT * FROM loan_schedules
          WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE
          ORDER BY dueDate ASC LIMIT 1
        `)
        .all<LoanScheduleRow>(loanId);

      if (overdueSchedules.length > 0) {
        const oldestOverdue = overdueSchedules[0];
        const oldestDueDate = new Date(oldestOverdue.dueDate);
        const dpd = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (dpd >= 90) {
          await database.run(`UPDATE loans SET status = 'Macet' WHERE id = ?`, [loanId]);
        }

        await database.run(
          `UPDATE loan_schedules SET status = 'Late', updatedAt = CURRENT_TIMESTAMP WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE`,
          [loanId]
        );
      }
    } else {
      const newTotalPaid = paid + input.amount;
      if (newTotalPaid >= totalAmount) {
        await database.run(`UPDATE loans SET status = 'Lunas' WHERE id = ?`, [loanId]);
      }
    }
  })();

  return { id };
}

export async function deleteLoan(database: Db, loanId: string): Promise<void> {
  const loan = await database.query("SELECT id FROM loans WHERE id = ?").get(loanId);
  if (!loan) {
    throw new ServiceError("Loan not found", 404);
  }

  const stmt = database.prepare("DELETE FROM loans WHERE id = ?");
  await stmt.run(loanId);
}