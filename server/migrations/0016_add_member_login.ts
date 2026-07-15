import type { Migration } from "./types";

export function createMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0016_add_member_login",
    async up() {
      const hasColumn = async (table: string, col: string): Promise<boolean> => {
        const row = await db.query(
          `SELECT 1 AS ok FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ? AND lower(column_name) = lower(?)`
        ).get(table, col);
        return !!row;
      };

      if (!(await hasColumn("members", "email"))) {
        await db.run(`ALTER TABLE members ADD COLUMN email TEXT UNIQUE`);
      }
      if (!(await hasColumn("members", "password"))) {
        await db.run(`ALTER TABLE members ADD COLUMN password TEXT`);
      }
    },
  };
}
