import type { Migration } from "./types";

/**
 * Migration 0041: Fix journal transaction_date for Didi Irawan savings withdrawal.
 * The transaction was approved after midnight WIB on 2026-09-30, but was recorded
 * as 2026-09-29 due to UTC timestamp truncation.
 */
export function createFixDidiIrawanJournalDateMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "0041_fix_didi_irawan_journal_date",
    async up() {
      await db.run(`
        UPDATE journal_entries
        SET transaction_date = '2026-09-30'
        WHERE reference_id = '6b5d7513-4601-4475-9171-80857a6ed3c4'
      `);
    },
  };
}
