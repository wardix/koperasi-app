import type { Migration } from "./types";

/**
 * Migration 0037: Add rejection_reason column to loans table.
 * Records the reason when an admin/loan officer rejects a loan application
 * and exposes it to the member via Member Portal and notifications.
 */
export function createAddLoanRejectionReasonMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0037_add_loan_rejection_reason",
    async up() {
      const columnExists = async (col: string): Promise<boolean> => {
        const row = (await db
          .query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'loans' AND column_name = ?`
          )
          .get(col.toLowerCase())) as { column_name?: string } | null;
        return !!row?.column_name;
      };

      if (!(await columnExists("rejection_reason"))) {
        await db.run(`ALTER TABLE loans ADD COLUMN rejection_reason TEXT`);
      }
    },
  };
}
