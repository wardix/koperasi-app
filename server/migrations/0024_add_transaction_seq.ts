import type { Migration } from "./types";

/**
 * Add seq SERIAL column to transactions table for reliable chronological ordering.
 * This ensures ORDER BY seq correctly reflects the insert order regardless of
 * createdAt values (which may be identical when data is bulk-imported).
 */
export function createAddTransactionSeqMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0024_add_transaction_seq",
    async up() {
      // Add seq column as SERIAL (auto-increment) - uses a sequence under the hood
      await db.run(`
        ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS seq BIGSERIAL
      `);

      // Create an index for efficient ordering
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_seq ON transactions (seq)
      `);
    },
  };
}
