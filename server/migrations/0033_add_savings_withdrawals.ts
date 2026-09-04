import type { Migration } from "./types";

/**
 * Migration 0033: Add savings_withdrawals table.
 * Enables cooperative members to submit voluntary savings (simpanan sukarela)
 * withdrawal requests from Member Portal, and admins/treasurers to review, approve,
 * or reject them with audit trail and auto-journaling.
 */
export function createAddSavingsWithdrawalsMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0033_add_savings_withdrawals",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS savings_withdrawals (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          amount BIGINT NOT NULL,
          destination_bank TEXT NOT NULL,
          destination_account TEXT NOT NULL,
          destination_name TEXT NOT NULL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'Menunggu',
          payment_source_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
          transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
          approved_by TEXT,
          approved_at TIMESTAMP WITH TIME ZONE,
          rejected_by TEXT,
          rejected_at TIMESTAMP WITH TIME ZONE,
          rejection_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_withdrawals_member_id ON savings_withdrawals(member_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_withdrawals_status ON savings_withdrawals(status)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_savings_withdrawals_created_at ON savings_withdrawals(created_at DESC)`);
    },
  };
}
