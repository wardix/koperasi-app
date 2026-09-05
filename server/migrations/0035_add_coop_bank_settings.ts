import type { Migration } from "./types";

/**
 * Migration 0035: Add official cooperative bank settings.
 * Sets default official cooperative bank details in settings table
 * so that they can be dynamically configured instead of hardcoded.
 */
export function createAddCoopBankSettingsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0035_add_coop_bank_settings",
    async up() {
      await db.run(`
        INSERT INTO settings (key, value)
        VALUES 
          ('coopBankName', 'Bank Mandiri'),
          ('coopBankAccountNumber', '1060022716008'),
          ('coopBankAccountName', 'Koperasi Jasa Nusa Sejahtera Prima')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
      `);
    },
  };
}
