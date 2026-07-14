import type { Migration } from "./types";

/**
 * Add TOTP two-factor authentication columns to admins table.
 * Each admin gets their own secret, recovery codes, and 2FA enabled flag.
 */
export function createAddTotp2FaMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0013_add_totp_2fa",
    async up() {
      // Add TOTP columns to admins table
      await db.run(`
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS totp_secret TEXT;
      `);

      await db.run(`
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
      `);

      await db.run(`
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS recovery_codes TEXT DEFAULT '[]';
      `);
    },
  };
}
