import type { Migration } from "./types";

/**
 * Migration 0036: Add averageSavings column to shu_member_allocations
 * and default setting for shu_include_inactive_members.
 */
export function createAddShuAverageSavingsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0036_add_shu_average_savings",
    async up() {
      await db.run(`
        ALTER TABLE shu_member_allocations 
        ADD COLUMN IF NOT EXISTS averageSavings BIGINT NOT NULL DEFAULT 0;
      `);

      await db.run(`
        INSERT INTO settings (key, value) 
        VALUES ('shu_include_inactive_members', 'true') 
        ON CONFLICT (key) DO NOTHING;
      `);
    },
  };
}
