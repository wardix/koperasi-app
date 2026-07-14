import type { Migration } from "./types";

/**
 * Improve token blacklist by using jti (JWT ID) instead of full JWT string.
 * - Rename token_blacklist.token column to jti_token for clarity
 * - Create refresh_token_blacklist table for refresh token tracking/revocation
 */
export function createAddJTiBlacklistMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0014_add_jti_blacklist",
    async up() {
      // Rename token column to jti_token in token_blacklist for clarity
      await db.run(`ALTER TABLE token_blacklist RENAME COLUMN token TO jti_token;`);

      // Drop old index if it exists (will be recreated)
      await db.run(`DROP INDEX IF EXISTS idx_token_blacklist_token;`);

      // Create new unique index on jti_token for efficient lookups
      await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti_token);`);

      // Create refresh_token_blacklist table for tracking/revoking refresh tokens
      await db.run(`
        CREATE TABLE IF NOT EXISTS refresh_token_blacklist (
          jti_token TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          expires_at BIGINT NOT NULL,
          revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index on admin_id for efficient user token revocation
      await db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_token_blacklist_admin ON refresh_token_blacklist(admin_id);`);
    },
  };
}
