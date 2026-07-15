import type { Migration } from "./types";

export function createMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0016_add_member_login",
    async up() {
      // Add password and email to members table if they don't exist
      await db.run(`ALTER TABLE members ADD COLUMN email TEXT UNIQUE`);
      await db.run(`ALTER TABLE members ADD COLUMN password TEXT`);
    },
  };
}
