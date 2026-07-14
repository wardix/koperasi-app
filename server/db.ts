import { SQL } from "bun";
const sql = new SQL(process.env.DATABASE_URL || "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_test");

class Statement {
  constructor(queryStr) { this.queryStr = queryStr; }
  getPgQuery() { let i = 1; return this.queryStr.replace(/\?/g, () => "$" + (i++)); }
  mapRow(row) {
    if (!row) return row;
    const keyMap = {
      balancebefore: 'balanceBefore',
      balanceafter: 'balanceAfter',
      paymentdate: 'paymentDate',
      paymentamount: 'paymentAmount',
      principalamount: 'principalAmount',
      totalsavings: 'totalSavings',
      simpananpokok: 'simpananPokok',
      simpananwajib: 'simpananWajib',
      simpanansukarela: 'simpananSukarela',
      joindate: 'joinDate',
      createdby: 'createdBy',
      createdat: 'createdAt',
      memberid: 'memberId',
      loanid: 'loanId',
      paidamount: 'paidAmount'
    };
    const mapped = {};
    for (const [k, v] of Object.entries(row)) {
      mapped[keyMap[k] || k] = v;
    }
    return mapped;
  }
  async get(...args) { const rows = await sql.unsafe(this.getPgQuery(), args); return rows.length > 0 ? this.mapRow(rows[0]) : null; }
  async all(...args) { const res = await sql.unsafe(this.getPgQuery(), args); return Array.isArray(res) ? res.map(r => this.mapRow(r)) : []; }
  async run(...args) { await sql.unsafe(this.getPgQuery(), args); }
}

const db = {
  query: (q) => new Statement(q),
  prepare: (q) => new Statement(q),
  run: async (q, args = []) => { await new Statement(q).run(...args); },
  transaction: async (cb) => {
    await db.run('BEGIN');
    try {
      await cb();
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  },
  close: () => sql.end()
};

import fs from "node:fs";
import path from "node:path";

// Create or open the SQLite database file
const dbPath = process.env.DATABASE_PATH || Bun.env.DATABASE_PATH || "koperasi.sqlite";

// Ensure parent directory exists if dbPath is not just a file name
const dir = path.dirname(dbPath);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}



// Enable foreign keys


// Initialize schema if not exists
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
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer'
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
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrations = [
  {
    name: '0001_add_memberId_to_loans',
    sql: `
      ALTER TABLE loans ADD COLUMN memberId TEXT REFERENCES members(id) ON DELETE RESTRICT;
      UPDATE loans SET memberId = (SELECT id FROM members WHERE members.name = loans.name LIMIT 1);
    `
  },
  {
    name: '0002_add_simpanan_columns_to_members',
    sql: `
      ALTER TABLE members ADD COLUMN simpananPokok INTEGER DEFAULT 0;
      ALTER TABLE members ADD COLUMN simpananWajib INTEGER DEFAULT 0;
      ALTER TABLE members ADD COLUMN simpananSukarela INTEGER DEFAULT 0;
      UPDATE members SET simpananPokok = totalSavings WHERE simpananPokok = 0 AND simpananWajib = 0 AND simpananSukarela = 0;
    `
  },
  {
    name: '0005_convert_tenor_to_integer',
    sql: `UPDATE loans SET tenor = CAST(REPLACE(tenor::text, ' Bulan', '') AS INTEGER);`
  },
  {
    name: '0006_add_google_sso_columns',
    sql: `
      ALTER TABLE admins ADD COLUMN google_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_google_id ON admins(google_id);
      ALTER TABLE admins ADD COLUMN name TEXT;
      ALTER TABLE admins ADD COLUMN avatar_url TEXT;
      ALTER TABLE admins ADD COLUMN auth_provider TEXT DEFAULT 'local';
      INSERT INTO settings (key, value) VALUES ('ssoAutoRegister', 'true');
    `
  },
  {
    name: '0007_add_createdAt_to_loans',
    sql: `
      ALTER TABLE loans ADD COLUMN createdAt TEXT;
      UPDATE loans SET createdAt = '2026-01-01T00:00:00.000Z' WHERE createdAt IS NULL;
    `
  }
];

await db.transaction(async () => {
  const applied = new Set((await db.query('SELECT name FROM schema_migrations').all() as any[]).map(m => m.name));
  for (const m of migrations) {
    if (!applied.has(m.name)) {
      try {
        const stmts = m.sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of stmts) {
          await db.run(stmt);
        }
        await db.run('INSERT INTO schema_migrations (name) VALUES (?)', [m.name]);
      } catch (err: any) {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists') || err.message.includes('no such column'))) {
          await db.run('INSERT INTO schema_migrations (name) VALUES (?)', [m.name]);
        } else {
          throw err;
        }
      }
    }
  }
})();

await db.query(`
  CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY,
    loanId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    paymentDate TEXT NOT NULL,
    method TEXT NOT NULL,
    FOREIGN KEY(loanId) REFERENCES loans(id) ON DELETE CASCADE
  );
`).run();

await db.run(`
  CREATE INDEX IF NOT EXISTS idx_transactions_memberId ON transactions(memberId);
  CREATE INDEX IF NOT EXISTS idx_transactions_createdAt ON transactions(createdAt);
  CREATE INDEX IF NOT EXISTS idx_loans_memberId ON loans(memberId);
  CREATE INDEX IF NOT EXISTS idx_loan_payments_loanId ON loan_payments(loanId);
  CREATE INDEX IF NOT EXISTS idx_loan_payments_paymentDate ON loan_payments(paymentDate);
  CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
  CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
`);

// Insert initial seed data if table is empty
const memberCount = await db.query("SELECT COUNT(*) as count FROM members").get() as { count: any };
if (Number(memberCount.count) === 0 && process.env.NODE_ENV === 'test') {
  const insert = await db.prepare("INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?)");
  await insert.run("1", "Budi Santoso", "Ketua", "Aktif", "01 Jan 2024", 5000000);
  await insert.run("2", "Siti Aminah", "Bendahara", "Aktif", "15 Feb 2024", 3500000);
  await insert.run("3", "Dewi Lestari", "Anggota", "Aktif", "20 Mar 2024", 2000000);
  await insert.run("4", "Joko Widodo", "Anggota", "Pasif", "10 Apr 2024", 1000000);

  const loanCount = await db.query("SELECT COUNT(*) as count FROM loans").get() as { count: any };
  if (Number(loanCount.count) === 0) {
    const insertLoan = await db.prepare("INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    await insertLoan.run("1", "1", "Budi Santoso", 5000000, 12, "Modal Usaha Warung", "Menunggu");
    await insertLoan.run("2", "2", "Siti Aminah", 2500000, 6, "Biaya Pendidikan", "Menunggu");
    await insertLoan.run("3", "3", "Dewi Lestari", 10000000, 24, "Renovasi Rumah", "Disetujui");
  }
}

const adminCount = await db.query("SELECT COUNT(*) as count FROM admins").get() as { count: any };
if (Number(adminCount.count) === 0) {
  const insert = await db.prepare("INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)");
  const hashedPassword = await Bun.password.hash("admin123");
  await insert.run("1", "admin@koperasi.com", hashedPassword, "superadmin");
}

const hasKoperasiName = await db.query("SELECT 1 FROM settings WHERE key = 'koperasiName'").get();
if (!hasKoperasiName) {
  const insertSetting = await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING");
  await insertSetting.run("koperasiName", "Koperasi Maju Bersama");
  await insertSetting.run("alamat", "Jl. Jend. Sudirman No. 123, Jakarta");
  await insertSetting.run("telepon", "021-555-0192");
  await insertSetting.run("email", "info@majubersama.co.id");
  await insertSetting.run("bungaPinjaman", "18");
  await insertSetting.run("bungaSimpanan", "4.0");
  await insertSetting.run("denda", "0.5");
  await insertSetting.run("viewReports", "false");
  await insertSetting.run("selfRegister", "true");
  await insertSetting.run("twoFactor", "false");
  await insertSetting.run("ssoAutoRegister", "true");
}

// Run JS migrations (like data conversion or password hashing) manually
const jsMigrations = [
  {
    name: '0003_convert_currency_to_int',
    run: async () => {
      const sampleMember = await db.query("SELECT totalSavings FROM members LIMIT 1").get() as any;
      if (sampleMember && typeof sampleMember.totalSavings === 'string' && sampleMember.totalSavings.startsWith('Rp')) {
        const members = await db.query("SELECT id, totalSavings FROM members").all() as any[];
        const updateMember = await db.prepare("UPDATE members SET totalSavings = ? WHERE id = ?");
        members.forEach(m => {
          const parsed = parseInt(m.totalSavings.replace(/\\D/g, ""), 10) || 0;
          updateMember.run(parsed, m.id);
        });
      }

      const sampleLoan = await db.query("SELECT amount FROM loans LIMIT 1").get() as any;
      if (sampleLoan && typeof sampleLoan.amount === 'string' && sampleLoan.amount.startsWith('Rp')) {
        const loans = await db.query("SELECT id, amount FROM loans").all() as any[];
        const updateLoan = await db.prepare("UPDATE loans SET amount = ? WHERE id = ?");
        loans.forEach(l => {
          const parsed = parseInt(l.amount.replace(/\\D/g, ""), 10) || 0;
          updateLoan.run(parsed, l.id);
        });
      }
    }
  },
  {
    name: '0004_hash_admin_passwords',
    run: async () => {
      const admins = await db.query("SELECT email, password FROM admins").all() as {email: string, password: string}[];
      const updateAdmin = await db.prepare("UPDATE admins SET password = ? WHERE email = ?");
      for (const admin of admins) {
        if (!admin.password.startsWith('$argon2id$')) {
          const hashed = await Bun.password.hash(admin.password);
          updateAdmin.run(hashed, admin.email);
        }
      }
    }
  }
];

const appliedJs = new Set((await db.query('SELECT name FROM schema_migrations').all() as any[]).map(m => m.name));
for (const m of jsMigrations) {
  if (!appliedJs.has(m.name)) {
    try {
      await m.run();
      await db.run('INSERT INTO schema_migrations (name) VALUES (?)', [m.name]);
    } catch (err) {
      console.error(`Error running JS migration ${m.name}:`, err);
    }
  }
}

export default db;
