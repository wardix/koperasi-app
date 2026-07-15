import type { Migration } from "./types";

/**
 * Improve token blacklist by using jti (JWT ID) instead of full JWT string.
 * - Rename token_blacklist.token column to jti_token for clarity
 * - Create refresh_token_blacklist table for refresh token tracking/revocation
 *
 * Idempotent: safe if column already renamed or table already exists
 * (e.g. re-apply after schema_migrations TRUNCATE in tests).
 */
export function createAddJTiBlacklistMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
}): Migration {
  return {
    name: "0014_add_jti_blacklist",
    async up() {
      const hasColumn = async (table: string, col: string): Promise<boolean> => {
        const row = await db.query(
          `SELECT 1 AS ok FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`
        ).get(table, col);
        return !!row;
      };

      // Rename token → jti_token only when old column still exists
      if (await hasColumn("token_blacklist", "token")) {
        await db.run(`ALTER TABLE token_blacklist RENAME COLUMN token TO jti_token;`);
      } else if (!(await hasColumn("token_blacklist", "jti_token"))) {
        // Fresh edge case: table exists without either column name
        await db.run(`ALTER TABLE token_blacklist ADD COLUMN IF NOT EXISTS jti_token TEXT;`);
      }

      await db.run(`DROP INDEX IF EXISTS idx_token_blacklist_token;`);
      await db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti_token);`
      );

      await db.run(`
        CREATE TABLE IF NOT EXISTS refresh_token_blacklist (
          jti_token TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          expires_at BIGINT NOT NULL,
          revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.run(
        `CREATE INDEX IF NOT EXISTS idx_refresh_token_blacklist_admin ON refresh_token_blacklist(admin_id);`
      );
    },
  };
}
