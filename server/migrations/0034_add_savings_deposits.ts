import type { Migration } from "./types";

/**
 * Migration 0034: Add savings_deposits table.
 * Allows members to submit bank transfer deposit confirmations for
 * Simpanan Pokok, Wajib, or Sukarela from the Member Portal, and
 * admins/treasurers to verify and book them with auto-journaling.
 */
export function createAddSavingsDepositsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0034_add_savings_deposits",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS savings_deposits (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          savings_type VARCHAR(20) NOT NULL,
          amount BIGINT NOT NULL,
          transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
          sender_bank TEXT,
          sender_account TEXT,
          sender_name TEXT,
          proof_url TEXT,
          proof_name TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'Menunggu',
          payment_target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
          transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
          verified_by TEXT,
          verified_at TIMESTAMP WITH TIME ZONE,
          rejected_by TEXT,
          rejected_at TIMESTAMP WITH TIME ZONE,
          rejection_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_deposits_member_id ON savings_deposits(member_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_deposits_status ON savings_deposits(status)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_deposits_created_at ON savings_deposits(created_at DESC)`);
    },
  };
}
