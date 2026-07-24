import type { Migration } from "./types";

/**
 * Add optional phone number for members.
 */
export function createAddMemberPhoneMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0021_add_member_phone",
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

      if (!(await hasColumn("members", "phone"))) {
        await db.run(`ALTER TABLE members ADD COLUMN phone TEXT`);
      }
    },
  };
}
