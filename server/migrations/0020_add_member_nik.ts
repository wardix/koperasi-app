import type { Migration } from "./types";

/**
 * Add optional NIK (Nomor Induk Kependudukan) to members.
 * 16-digit national ID; unique when set.
 */
export function createAddMemberNikMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0020_add_member_nik",
    async up() {
      const hasColumn = async (table: string, col: string): Promise<boolean> => {
        const row = await db
          .query(
            `SELECT 1 AS ok FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ? AND lower(column_name) = lower(?)`
          )
          .get(table, col);
        return !!row;
      };

      if (!(await hasColumn("members", "nik"))) {
        await db.run(`ALTER TABLE members ADD COLUMN nik TEXT`);
        await db.run(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_nik_unique
           ON members (nik) WHERE nik IS NOT NULL AND nik <> ''`
        );
      }
    },
  };
}
