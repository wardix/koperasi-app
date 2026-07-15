import type { Migration } from "./types";

/**
 * Add soft-delete support: `deletedAt` timestamp column on members and loans.
 *
 * - NULL  → active (default)
 * - non-NULL → soft-deleted (archived); value is the ISO-8601 deletion time
 *
 * Partial indexes ensure active-row uniqueness constraints (email, etc.)
 * remain sensible after soft-delete. Existing FK constraints are kept —
 * hard-delete is still blocked by the DB; the app layer redirects the
 * DELETE API to a soft-delete instead.
 *
 * Idempotent: each ALTER is guarded by a column-existence check so the
 * migration can be re-applied safely (e.g. after test teardown).
 */
export function createSoftDeleteMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0015_soft_delete",
    async up() {
      const hasColumn = async (table: string, col: string): Promise<boolean> => {
        const row = await db.query(
          `SELECT 1 AS ok FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`
        ).get(table, col);
        return !!row;
      };

      // --- members.deletedAt ---
      if (!(await hasColumn("members", "deletedAt"))) {
        await db.run(`ALTER TABLE members ADD COLUMN deletedAt TEXT DEFAULT NULL`);
      }

      // Partial index: fast lookup of active members
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_members_active
        ON members(id) WHERE deletedAt IS NULL
      `);

      // --- loans.deletedAt ---
      if (!(await hasColumn("loans", "deletedAt"))) {
        await db.run(`ALTER TABLE loans ADD COLUMN deletedAt TEXT DEFAULT NULL`);
      }

      // Partial index: fast lookup of active loans
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_loans_active
        ON loans(id) WHERE deletedAt IS NULL
      `);
    },
  };
}
