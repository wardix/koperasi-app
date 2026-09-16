import type { Migration } from "./types";

/**
 * Migration 0039: Synchronize letter_sequences with existing official_letters records.
 * Ensures the auto-numbering counter continues from the latest recorded letters (e.g. 039).
 */
export function createSyncLetterSequencesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0039_sync_letter_sequences",
    async up() {
      await db.run(`
        INSERT INTO letter_sequences (category, year, last_seq)
        VALUES ('PINJAMAN_ANGGOTA', 2026, 39)
        ON CONFLICT (category, year)
        DO UPDATE SET last_seq = CASE 
          WHEN letter_sequences.last_seq < 39 THEN 39 
          ELSE letter_sequences.last_seq 
        END
      `);

      await db.run(`
        INSERT INTO letter_sequences (category, year, last_seq)
        VALUES ('SURAT_KELUAR', 2026, 1)
        ON CONFLICT (category, year)
        DO UPDATE SET last_seq = CASE 
          WHEN letter_sequences.last_seq < 1 THEN 1 
          ELSE letter_sequences.last_seq 
        END
      `);
    },
  };
}
