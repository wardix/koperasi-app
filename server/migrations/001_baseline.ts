import type { Migration } from "./types";

/**
 * Full current schema for fresh databases.
 * Uses IF NOT EXISTS so it is also safe on partially provisioned DBs.
 * Historical incremental ALTERs (0001, 0002, 0005–0007) are folded into this baseline.
 */
export function createBaselineMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
}): Migration {
  return {
    name: "001_baseline",
    async up() {
      await db.run(`
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          joinDate TEXT NOT NULL,
          simpananPokok INTEGER DEFAULT 0,
          simpananWajib INTEGER DEFAULT 0,
          simpananSukarela INTEGER DEFAULT 0,
          totalSavings INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          memberId TEXT REFERENCES members(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          balanceBefore INTEGER NOT NULL,
          balanceAfter INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          createdBy TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY,
          memberId TEXT REFERENCES members(id) ON DELETE RESTRICT,
          name TEXT NOT NULL,
          amount INTEGER NOT NULL,
          tenor INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          google_id TEXT,
          name TEXT,
          avatar_url TEXT,
          auth_provider TEXT DEFAULT 'local'
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS token_blacklist (
          token TEXT PRIMARY KEY,
          expires_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
          ip TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS loan_payments (
          id TEXT PRIMARY KEY,
          loanId TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          paymentDate TEXT NOT NULL,
          method TEXT NOT NULL
        );
      `);

      await db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_google_id ON admins(google_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_memberId ON transactions(memberId);
        CREATE INDEX IF NOT EXISTS idx_transactions_createdAt ON transactions(createdAt);
        CREATE INDEX IF NOT EXISTS idx_loans_memberId ON loans(memberId);
        CREATE INDEX IF NOT EXISTS idx_loan_payments_loanId ON loan_payments(loanId);
        CREATE INDEX IF NOT EXISTS idx_loan_payments_paymentDate ON loan_payments(paymentDate);
        CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
        CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
      `);

      // Default setting introduced by historical 0006 (idempotent)
      await db.run(
        `INSERT INTO settings (key, value) VALUES ('ssoAutoRegister', 'true') ON CONFLICT (key) DO NOTHING`
      );
    },
  };
}
