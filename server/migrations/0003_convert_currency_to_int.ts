import type { Migration } from "./types";

/** One-time data fix: currency strings like "Rp 1.000" → integer. */
export function createConvertCurrencyMigration(db: {
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
  prepare: (q: string) => { run: (...args: unknown[]) => Promise<void> };
}): Migration {
  return {
    name: "0003_convert_currency_to_int",
    async up() {
      const sampleMember = (await db.query("SELECT totalSavings FROM members LIMIT 1").get()) as {
        totalSavings?: unknown;
      } | null;
      if (
        sampleMember &&
        typeof sampleMember.totalSavings === "string" &&
        sampleMember.totalSavings.startsWith("Rp")
      ) {
        const members = (await db.query("SELECT id, totalSavings FROM members").all()) as {
          id: string;
          totalSavings: string;
        }[];
        const updateMember = db.prepare("UPDATE members SET totalSavings = ? WHERE id = ?");
        for (const m of members) {
          const parsed = parseInt(String(m.totalSavings).replace(/\D/g, ""), 10) || 0;
          await updateMember.run(parsed, m.id);
        }
      }

      const sampleLoan = (await db.query("SELECT amount FROM loans LIMIT 1").get()) as {
        amount?: unknown;
      } | null;
      if (sampleLoan && typeof sampleLoan.amount === "string" && sampleLoan.amount.startsWith("Rp")) {
        const loans = (await db.query("SELECT id, amount FROM loans").all()) as {
          id: string;
          amount: string;
        }[];
        const updateLoan = db.prepare("UPDATE loans SET amount = ? WHERE id = ?");
        for (const l of loans) {
          const parsed = parseInt(String(l.amount).replace(/\D/g, ""), 10) || 0;
          await updateLoan.run(parsed, l.id);
        }
      }
    },
  };
}
