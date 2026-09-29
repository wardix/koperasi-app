import type { Migration } from "./types";

/**
 * Migration 0040: Set created_by to NULL for EWA auto-journals so they display as 'Sistem'
 * consistent with other auto-generated transactions (loan disbursement, savings, etc.).
 */
export function createSetEwaJournalCreatorSystemMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0040_set_ewa_journal_creator_system",
    async up() {
      await db.run(`
        UPDATE journal_entries
        SET created_by = NULL
        WHERE reference_type IN ('ewa_disbursement', 'ewa_payroll_settlement')
      `);
    },
  };
}
