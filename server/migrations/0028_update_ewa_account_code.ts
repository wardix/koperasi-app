import type { Migration } from "./types";

export function createUpdateEwaAccountCodeMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
}): Migration {
  return {
    id: "0028_update_ewa_account_code",
    name: "0028_update_ewa_account_code",
    up: async () => {
      // 1. Check if 41201 exists, update code to 41103
      const acc41201 = (await db.query(
        `SELECT id FROM accounts WHERE code = '41201' LIMIT 1`
      ).get()) as { id?: string } | undefined;

      if (acc41201?.id) {
        await db.run(
          `UPDATE accounts SET code = '41103' WHERE id = ?`,
          [acc41201.id]
        );
      } else {
        const acc41103 = (await db.query(
          `SELECT id FROM accounts WHERE code = '41103' LIMIT 1`
        ).get()) as { id?: string } | undefined;

        if (!acc41103?.id) {
          await db.run(
            `INSERT INTO accounts (code, name, type, normal_balance) VALUES ($1, $2, $3, $4)`,
            ['41103', 'Pendapatan Administrasi EWA', 'REVENUE', 'CREDIT']
          );
        }
      }
    },
  };
}
