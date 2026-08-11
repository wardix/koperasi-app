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
          // Aset
          { code: '11101', name: 'Kas Kecil', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '11102', name: 'Bank Mandiri', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '11201', name: 'Piutang Pinjaman Anggota', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '11202', name: 'Cadangan Kerugian Piutang', type: 'ASSET', normal_balance: 'CREDIT' }, // Contra-asset
          { code: '11301', name: 'Piutang Potong Gaji (Payroll)', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '11401', name: 'Perlengkapan Kantor', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '12101', name: 'Peralatan Kantor', type: 'ASSET', normal_balance: 'DEBIT' },
          { code: '12102', name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', normal_balance: 'CREDIT' }, // Contra-asset
          // Kewajiban
          { code: '21101', name: 'Simpanan Sukarela Anggota', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '21102', name: 'Simpanan Berjangka Koperasi', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '21201', name: 'Beban Yang Masih Harus Dibayar', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '21301', name: 'Utang Pajak (PPh 21/23/Final)', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '22101', name: 'Dana Bagian RAT', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '22102', name: 'Dana Pengurus & Pengawas', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '22103', name: 'Dana Karyawan', type: 'LIABILITY', normal_balance: 'CREDIT' },
          { code: '22104', name: 'Dana Sosial & Pendidikan', type: 'LIABILITY', normal_balance: 'CREDIT' },
          // Ekuitas
          { code: '31101', name: 'Simpanan Pokok', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '31102', name: 'Simpanan Wajib', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '32101', name: 'Cadangan Koperasi', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '33101', name: 'SHU Ditahan', type: 'EQUITY', normal_balance: 'CREDIT' },
          { code: '33102', name: 'SHU Tahun Berjalan', type: 'EQUITY', normal_balance: 'CREDIT' },
          // Pendapatan
          { code: '41101', name: 'Pendapatan Jasa Pinjaman', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '41102', name: 'Pendapatan Provisi / Administrasi', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '42101', name: 'Pendapatan Bunga Bank', type: 'REVENUE', normal_balance: 'CREDIT' },
          { code: '42102', name: 'Pendapatan Denda', type: 'REVENUE', normal_balance: 'CREDIT' },
          // Beban
          { code: '51101', name: 'Beban Jasa Simpanan Sukarela', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '51102', name: 'Beban Jasa Simpanan Berjangka', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '61101', name: 'Beban Gaji & Tunjangan Karyawan', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '61102', name: 'Beban Kerugian Piutang Macet', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '61201', name: 'Beban Operasional Kantor', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '61202', name: 'Beban Penyusutan Aset', type: 'EXPENSE', normal_balance: 'DEBIT' },
          { code: '61301', name: 'Beban Pelaksanaan RAT', type: 'EXPENSE', normal_balance: 'DEBIT' },
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
