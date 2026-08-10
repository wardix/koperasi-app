import type { Migration } from "./types";

/**
 * Drop the expenses table — all expense data will be recorded via journal_entries (Jurnal Umum).
 */
export function createDropExpensesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0023_drop_expenses",
    async up() {
      await db.run(`DROP INDEX IF EXISTS idx_expenses_expenseDate`);
      await db.run(`DROP INDEX IF EXISTS idx_expenses_category`);
      await db.run(`DROP INDEX IF EXISTS idx_expenses_active`);
      await db.run(`DROP TABLE IF EXISTS expenses`);
    },
  };
}
