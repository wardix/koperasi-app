import type { Migration } from "./types";

/**
 * Cooperative operating expenses (pengeluaran) — notaris, ATK, sewa, etc.
 * Soft-delete via deletedAt; cashflow treats rows as outflows.
 */
export function createAddExpensesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0018_add_expenses",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          expenseDate TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          paymentMethod TEXT NOT NULL DEFAULT 'Transfer',
          createdBy TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT,
          deletedAt TEXT
        )
      `);

      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_expenses_expenseDate
        ON expenses(expenseDate)
      `);

      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_expenses_category
        ON expenses(category)
      `);

      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_expenses_active
        ON expenses(id) WHERE deletedAt IS NULL
      `);
    },
  };
}
