import type { Migration } from "./types";

/**
 * Add SHU (Sisa Hasil Usaha) configuration and year-end closing tables.
 * Supports configurable SHU distribution parameters and permanent period locking.
 */
export function createShuClosingMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
}): Migration {
  return {
    name: "0010_shu_configurable_and_closing",
    async up() {
      // 1. Create shu_closes table for year-end closing logs
      await db.run(`
        CREATE TABLE IF NOT EXISTS shu_closes (
          year TEXT PRIMARY KEY,
          pendapatan INTEGER NOT NULL,
          biayaOperasional INTEGER NOT NULL,
          shuNetto INTEGER NOT NULL,
          distribusi JSONB NOT NULL,
          closedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          closedBy TEXT NOT NULL
        )
      `);

      // 2. Create shu_member_allocations table for permanent member allocations
      await db.run(`
        CREATE TABLE IF NOT EXISTS shu_member_allocations (
          year TEXT NOT NULL,
          memberId TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          savingsShare INTEGER NOT NULL DEFAULT 0,
          loansShare INTEGER NOT NULL DEFAULT 0,
          totalSHU INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (year, memberId)
        )
      `);

      // 3. Insert default SHU distribution settings if not exists
      const insertSetting = async (key: string, val: string) => {
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING", [key, val]);
      };

      await insertSetting("shu_cadangan_pct", "25");
      await insertSetting("shu_anggota_pct", "40");
      await insertSetting("shu_pengurus_pct", "20");
      await insertSetting("shu_sosial_pct", "10");
      await insertSetting("shu_pembangunan_pct", "5");
      await insertSetting("shu_jasa_simpanan_pct", "50"); // 50% of anggota allocation for savings service
      await insertSetting("shu_jasa_pinjaman_pct", "50"); // 50% of anggota allocation for loan service
    }
  };
}
