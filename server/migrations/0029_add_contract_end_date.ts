import type { Migration } from "./types";

export function createAddContractEndDateMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
}): Migration {
  return {
    id: "0029_add_contract_end_date",
    name: "0029_add_contract_end_date",
    up: async () => {
      await db.run(
        `ALTER TABLE company_employees ADD COLUMN IF NOT EXISTS contract_end_date DATE`
      );
    },
  };
}
