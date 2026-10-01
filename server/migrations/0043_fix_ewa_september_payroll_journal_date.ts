import type { Migration } from "./types";

/**
 * Migration 0043: Fix journal transaction_date for September 2026 EWA payroll settlement.
 * The settlement was recorded on 2026-10-01 but should be effective on 2026-09-30.
 */
export function createFixEwaSeptemberPayrollJournalDateMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0043_fix_ewa_september_payroll_journal_date",
    async up() {
      await db.run(`
        UPDATE journal_entries
        SET transaction_date = '2026-09-30'
        WHERE reference_type = 'ewa_payroll_settlement'
          AND reference_id = '2026-09'
      `);
    },
  };
}
