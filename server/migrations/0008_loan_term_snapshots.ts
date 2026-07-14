import type { Migration } from "./types";

/**
 * Add snapshot columns to loans table for interest rate and terms.
 * When a loan is approved, these values are captured so that future changes
 * to the global `bungaPinjaman` setting do not retroactively alter historical loans.
 */
export function createLoanTermSnapshotsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
}): Migration {
  return {
    name: "0008_loan_term_snapshots",
    async up() {
      // Helper to check if column exists (Postgres folds unquoted identifiers to lowercase)
      const columnExists = async (colName: string): Promise<boolean> => {
        const row = await db.query(
          `SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loans' AND column_name = ?`
        ).get(colName.toLowerCase()); // Postgres folds to lowercase in information_schema
        return !!row;
      };

      if (!(await columnExists('interestRate'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN interestRate DECIMAL(5,2)`);
      }
      if (!(await columnExists('monthlyPayment'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN monthlyPayment INTEGER`);
      }
      if (!(await columnExists('interestAmount'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN interestAmount INTEGER`);
      }
      if (!(await columnExists('totalAmount'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN totalAmount INTEGER`);
      }
      if (!(await columnExists('approvedAt'))) {
        await db.run(`ALTER TABLE loans ADD COLUMN approvedAt TIMESTAMP`);
      }

      // Backfill existing approved loans with current settings for historical consistency
      const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
      if (!bungaSetting) return;

      const annualRatePercent = parseFloat(bungaSetting.value);
      if (isNaN(annualRatePercent)) return;

      // Use the same calculation logic as calculateLoanInterest in loanService
      const i = annualRatePercent / 1200; // Convert percent to monthly decimal rate
      const approvedLoans: any[] = await db.query("SELECT id, amount, tenor FROM loans WHERE status = 'Disetujui'").all();

      for (const loan of approvedLoans) {
        if (!loan.amount || !loan.tenor) continue;

        const n = parseInt(loan.tenor);
        const power = Math.pow(1 + i, n);
        const monthlyPayment = loan.amount * (i * power) / (power - 1);
        const roundedMonthlyPayment = Math.ceil(monthlyPayment);
        const totalAmount = roundedMonthlyPayment * n;

        await db.run(
          `UPDATE loans SET interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ? AND (interestRate IS NULL OR approvedAt IS NULL)`,
          [annualRatePercent, roundedMonthlyPayment, totalAmount, totalAmount - loan.amount, loan.id]
        );
      }
    },
  };
}