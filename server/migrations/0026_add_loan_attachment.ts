import type { Migration } from "./types";

/**
 * Migration 0026: Add attachmentUrl and attachmentName to loans table for supporting documents.
 */
export function createAddLoanAttachmentMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0026_add_loan_attachment",
    async up() {
      // Check column existence for PostgreSQL
      const columnExists = async (col: string): Promise<boolean> => {
        const row = (await db
          .query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'loans' AND column_name = ?`
          )
          .get(col.toLowerCase())) as { column_name?: string } | null;
        return !!row?.column_name;
      };

      if (!(await columnExists("attachmentUrl"))) {
        await db.run(`ALTER TABLE loans ADD COLUMN "attachmentUrl" TEXT`);
      }
      if (!(await columnExists("attachmentName"))) {
        await db.run(`ALTER TABLE loans ADD COLUMN "attachmentName" TEXT`);
      }
    },
  };
}
