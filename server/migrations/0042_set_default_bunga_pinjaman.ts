import type { Migration } from "./types";

/**
 * Migration 0042: Restore bungaPinjaman to 9.10462 in settings.
 * Rate was set to 9.10462 on 2026-09-04 for Kopnutera annuity rate alignment,
 * but was inadvertently overwritten by test suites.
 */
export function createSetDefaultBungaPinjamanMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0042_set_default_bunga_pinjaman",
    async up() {
      await db.run(`
        UPDATE settings
        SET value = '9.10462'
        WHERE key = 'bungaPinjaman'
      `);
    },
  };
}
