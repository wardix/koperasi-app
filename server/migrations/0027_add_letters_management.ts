import type { Migration } from "./types";

/**
 * Migration 0027: Add Official Letters Management & Auto-Numbering Engine.
 * - letter_sequences: Atomic counters per category & year to guarantee zero duplicates.
 * - official_letters: Registry of official cooperative letters & agreements.
 */
export function createAddLettersManagementMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0027_add_letters_management",
    async up() {
      // 1. Sequences table for atomic letter numbering
      await db.run(`
        CREATE TABLE IF NOT EXISTS letter_sequences (
          category VARCHAR(50) NOT NULL,
          year INT NOT NULL,
          last_seq INT NOT NULL DEFAULT 0,
          PRIMARY KEY (category, year)
        )
      `);

      // 2. Official letters registry table
      await db.run(`
        CREATE TABLE IF NOT EXISTS official_letters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          letter_number VARCHAR(120) UNIQUE NOT NULL,
          seq_number INT NOT NULL,
          category VARCHAR(50) NOT NULL,
          letter_date DATE NOT NULL,
          party_name VARCHAR(150) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          description TEXT,
          amount DECIMAL(15,2),
          attachment_url TEXT,
          attachment_name TEXT,
          status VARCHAR(20) DEFAULT 'AKTIF' NOT NULL,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // 3. Helpful indices
      await db.run(`CREATE INDEX IF NOT EXISTS idx_official_letters_category ON official_letters(category)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_official_letters_date ON official_letters(letter_date DESC)`);
    },
  };
}
