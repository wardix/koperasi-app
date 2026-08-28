import type { Migration } from "./types";

export function createEwaFeeTiersMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
}): Migration {
  return {
    id: "0030_create_ewa_fee_tiers",
    name: "0030_create_ewa_fee_tiers",
    up: async () => {
      await db.run(`
        CREATE TABLE IF NOT EXISTS ewa_fee_tiers (
          id TEXT PRIMARY KEY,
          min_amount NUMERIC NOT NULL,
          max_amount NUMERIC NULL,
          member_fee NUMERIC NOT NULL,
          non_member_fee NUMERIC NOT NULL,
          tier_order INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Seed default tiers if empty
      const existing = await db.query("SELECT COUNT(*) as count FROM ewa_fee_tiers").get() as any;
      if (Number(existing?.count || 0) === 0) {
        await db.run(`
          INSERT INTO ewa_fee_tiers (id, min_amount, max_amount, member_fee, non_member_fee, tier_order)
          VALUES 
            (gen_random_uuid()::text, 0, 500000, 10000, 15000, 1),
            (gen_random_uuid()::text, 500001, 1000000, 18000, 25000, 2),
            (gen_random_uuid()::text, 1000001, 2500000, 30000, 45000, 3),
            (gen_random_uuid()::text, 2500001, NULL, 45000, 65000, 4)
        `);
      }
    },
  };
}
