import type { Migration } from "./types";

/**
 * Add General Ledger Accounting tables: accounts, journal_entries, journal_lines.
 */
export function createAddAccountingMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0022_add_accounting",
    async up() {
      // 1. Chart of Accounts
      await db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          normal_balance VARCHAR(10) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // 2. Journal Entries (Header)
      await db.run(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transaction_date DATE NOT NULL,
          description TEXT NOT NULL,
          reference_type VARCHAR(50),
          reference_id TEXT,
          created_by TEXT REFERENCES admins(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // 3. Journal Lines (Debit/Credit)
      await db.run(`
        CREATE TABLE IF NOT EXISTS journal_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
          account_id UUID NOT NULL REFERENCES accounts(id),
          debit DECIMAL(15,2) DEFAULT 0 NOT NULL,
          credit DECIMAL(15,2) DEFAULT 0 NOT NULL,
          description TEXT
        )
      `);

      // Index for faster queries
      await db.run(`CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(transaction_date)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id)`);

      // 4. Seed basic accounts if they don't exist
      const accountsCountRes = (await db.query(`SELECT COUNT(*) as count FROM accounts`).get()) as { count: string | number };
      const count = Number(accountsCountRes.count);
      
      if (count === 0) {
        const initialAccounts = [
          // Aset (Harta)
          { code: '1110', name: 'Kas Operasional (Tunai)', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '1120', name: 'Kas Bank', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '1210', name: 'Piutang Pinjaman Anggota (Pokok)', type: 'ASSET', normal_balance: 'DEBIT' },
          // Kewajiban (Hutang)
          { code: '2110', name: 'Simpanan Sukarela Anggota', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '2210', name: 'Hutang Bank / Pihak Ketiga', type: 'LIABILITY', normal_balance: 'CREDIT' },
          // Ekuitas (Modal)
          { code: '3110', name: 'Simpanan Pokok', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '3120', name: 'Simpanan Wajib', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '3210', name: 'SHU Tahun Berjalan', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '3220', name: 'Cadangan Modal', type: 'EQUITY', normal_balance: 'CREDIT' },
          // Pendapatan
          { code: '4110', name: 'Pendapatan Bunga Pinjaman Anggota', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '4120', name: 'Pendapatan Administrasi', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '4210', name: 'Pendapatan Bunga Bank', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '4220', name: 'Pendapatan Lain-lain', type: 'REVENUE', normal_balance: 'CREDIT' },
          // Beban (Pengeluaran)
          { code: '5110', name: 'Beban Gaji & Honor', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '5120', name: 'Beban Utilitas (Listrik/Air/Internet)', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '5210', name: 'Beban Bunga Hutang Pihak Ketiga', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '5220', name: 'Beban Pajak / Notaris / Legal', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '5990', name: 'Beban Lain-lain', type: 'EXPENSE', normal_balance: 'DEBIT' },
        ];

        for (const acc of initialAccounts) {
          await db.run(
            `INSERT INTO accounts (code, name, type, normal_balance) VALUES ($1, $2, $3, $4)`,
            [acc.code, acc.name, acc.type, acc.normal_balance]
          );
        }
      }
    },
  };
}
