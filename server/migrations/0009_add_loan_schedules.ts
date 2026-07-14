import type { Migration } from "./types";

/**
 * Add loan_schedules table for installment tracking.
 * Each approved loan gets a schedule of installments with due dates, amounts, and status.
 */
export function createLoanSchedulesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
}): Migration {
  return {
    name: "0009_add_loan_schedules",
    async up() {
      // Helper to check if column exists (Postgres folds unquoted identifiers to lowercase)
      const columnExists = async (table: string, colName: string): Promise<boolean> => {
        const row = await db.query(
          `SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`
        ).get(table.toLowerCase(), colName.toLowerCase());
        return !!row;
      };

      // Create loan_schedules table if not exists
      const scheduleTableExists = await db.query(
        `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?`
      ).get('loan_schedules');

      if (!scheduleTableExists) {
        await db.run(`
          CREATE TABLE IF NOT EXISTS loan_schedules (
            id TEXT PRIMARY KEY,
            loanId TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
            installmentNo INTEGER NOT NULL,
            dueDate DATE NOT NULL,
            principalAmount INTEGER NOT NULL DEFAULT 0,
            interestAmount INTEGER NOT NULL DEFAULT 0,
            paidAmount INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Pending',
            lateFee INTEGER NOT NULL DEFAULT 0,
            paidAt TIMESTAMP,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(loanId, installmentNo)
          )
        `);

        // Add indexes for common queries
        await db.run(`CREATE INDEX IF NOT EXISTS idx_loan_schedules_loanId ON loan_schedules(loanId)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_loan_schedules_dueDate ON loan_schedules(dueDate)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_loan_schedules_status ON loan_schedules(status)`);
      }

      // Add columns to loans table if not exists (for schedule-related fields)
      if (!(await columnExists('loans', 'scheduleGenerated')) {
        await db.run(`ALTER TABLE loans ADD COLUMN scheduleGenerated BOOLEAN DEFAULT FALSE`);
      }
      if (!(await columnExists('loans', 'totalInstallments'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN totalInstallments INTEGER DEFAULT 0`);
      }
      if (!(await columnExists('loans', 'paidInstallments'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN paidInstallments INTEGER DEFAULT 0`);
      }

      // Backfill existing approved loans with schedules (if not already done)
      const approvedLoans = await db.query(
        `SELECT l.id, l.amount, l.tenor, l.interestRate
         FROM loans l
         WHERE l.status = 'Disetujui' AND l.scheduleGenerated IS FALSE`
      ).all();

      for (const loan of approvedLoans as any[]) {
        if (!loan.amount || !loan.tenor) continue;

        const tenorMonths = parseInt(loan.tenor);
        const annualRatePercent = parseFloat(loan.interestRate || '18');

        // Calculate using annuity formula (same as #195 snapshot logic)
        const i = annualRatePercent / 1200; // Monthly rate
        const power = Math.pow(1 + i, tenorMonths);
        const monthlyPayment = loan.amount * (i * power) / (power - 1);
        const roundedMonthlyPayment = Math.ceil(monthlyPayment);
        const totalAmount = roundedMonthlyPayment * tenorMonths;
        const interestAmount = totalAmount - loan.amount;

        // Generate installment schedule
        for (let month = 1; month <= tenorMonths; month++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + month);

          // Calculate principal and interest for this installment
          const remainingPrincipal = loan.amount - (loan.amount * (month - 1) / tenorMonths);
          const currentPrincipal = Math.floor(remainingPrincipal / (tenorMonths - month + 1));
          const currentInterest = Math.round((loan.amount - currentPrincipal * (tenorMonths - month + 1)) * i);

          await db.run(`
            INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
            ON CONFLICT (loanId, installmentNo) DO NOTHING
          `, [
            `${loan.id}-${month}`,
            loan.id,
            month,
            dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
            currentPrincipal,
            currentInterest
          ]);
        }

        // Mark schedule as generated
        await db.run(`UPDATE loans SET scheduleGenerated = TRUE, totalInstallments = ? WHERE id = ?`, [tenorMonths, loan.id]);
      }
    },
  };
}