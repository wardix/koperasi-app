import { Database } from "bun:sqlite";

// Create or open the SQLite database file
const db = new Database("koperasi.sqlite", { create: true });

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON;");

// Initialize schema if not exists
db.run(`
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
    tenor TEXT NOT NULL,
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
`);

try {
  db.run("ALTER TABLE loans ADD COLUMN memberId TEXT REFERENCES members(id) ON DELETE RESTRICT");
  db.run(`
    UPDATE loans 
    SET memberId = (
      SELECT id FROM members WHERE members.name = loans.name LIMIT 1
    )
  `);
} catch (e) {
  // Ignore if column already exists
}

db.query(`
  CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY,
    loanId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    paymentDate TEXT NOT NULL,
    method TEXT NOT NULL,
    FOREIGN KEY(loanId) REFERENCES loans(id) ON DELETE CASCADE
  );
`).run();

// Insert initial seed data if table is empty
const memberCount = db.query("SELECT COUNT(*) as count FROM members").get() as { count: number };
if (memberCount.count === 0) {
  const insert = db.prepare("INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("1", "Budi Santoso", "Ketua", "Aktif", "01 Jan 2024", 5000000);
  insert.run("2", "Siti Aminah", "Bendahara", "Aktif", "15 Feb 2024", 3500000);
  insert.run("3", "Joko Widodo", "Anggota", "Pasif", "10 Mar 2024", 1000000);
}

// 2. Migration for members table: simpananPokok, simpananWajib, simpananSukarela
try {
  db.query('ALTER TABLE members ADD COLUMN simpananPokok INTEGER DEFAULT 0').run();
  db.query('ALTER TABLE members ADD COLUMN simpananWajib INTEGER DEFAULT 0').run();
  db.query('ALTER TABLE members ADD COLUMN simpananSukarela INTEGER DEFAULT 0').run();
  
  // If we want to safely distribute existing totalSavings into simpananPokok as default for old data:
  db.query('UPDATE members SET simpananPokok = totalSavings WHERE simpananPokok = 0 AND simpananWajib = 0 AND simpananSukarela = 0').run();
  console.log('Migrated members table: Added simpanan columns.');
} catch (err) {
  // Columns already exist
}

const loanCount = db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number };
if (loanCount.count === 0) {
  const insertLoan = db.prepare("INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertLoan.run("1", "1", "Budi Santoso", 5000000, "12 Bulan", "Modal Usaha Warung", "Menunggu");
  insertLoan.run("2", "2", "Siti Aminah", 2500000, "6 Bulan", "Biaya Pendidikan", "Menunggu");
  insertLoan.run("3", "Dewi Lestari", 10000000, "24 Bulan", "Renovasi Rumah", "Disetujui");
}

const adminCount = db.query("SELECT COUNT(*) as count FROM admins").get() as { count: number };
if (adminCount.count === 0) {
  const insert = db.prepare("INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)");
  const hashedPassword = await Bun.password.hash("admin123");
  insert.run("1", "admin@koperasi.com", hashedPassword, "superadmin");
}

const settingsCount = db.query("SELECT COUNT(*) as count FROM settings").get() as { count: number };
if (settingsCount.count === 0) {
  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  insertSetting.run("koperasiName", "Koperasi Maju Bersama");
  insertSetting.run("alamat", "Jl. Jend. Sudirman No. 123, Jakarta");
  insertSetting.run("telepon", "021-555-0192");
  insertSetting.run("email", "info@majubersama.co.id");
  insertSetting.run("bungaPinjaman", "1.5");
  insertSetting.run("bungaSimpanan", "4.0");
  insertSetting.run("denda", "0.5");
  insertSetting.run("viewReports", "false");
  insertSetting.run("selfRegister", "true");
  insertSetting.run("twoFactor", "false");
}

// Migrate existing data from TEXT to INTEGER if needed
try {
  const sampleMember = db.query("SELECT totalSavings FROM members LIMIT 1").get() as any;
  if (sampleMember && typeof sampleMember.totalSavings === 'string' && sampleMember.totalSavings.startsWith('Rp')) {
    const members = db.query("SELECT id, totalSavings FROM members").all() as any[];
    const updateMember = db.prepare("UPDATE members SET totalSavings = ? WHERE id = ?");
    members.forEach(m => {
      const parsed = parseInt(m.totalSavings.replace(/\\D/g, ""), 10) || 0;
      updateMember.run(parsed, m.id);
    });
  }

  const sampleLoan = db.query("SELECT amount FROM loans LIMIT 1").get() as any;
  if (sampleLoan && typeof sampleLoan.amount === 'string' && sampleLoan.amount.startsWith('Rp')) {
    const loans = db.query("SELECT id, amount FROM loans").all() as any[];
    const updateLoan = db.prepare("UPDATE loans SET amount = ? WHERE id = ?");
    loans.forEach(l => {
      const parsed = parseInt(l.amount.replace(/\\D/g, ""), 10) || 0;
      updateLoan.run(parsed, l.id);
    });
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Migrate plaintext admin passwords to hash
try {
  const admins = db.query("SELECT email, password FROM admins").all() as {email: string, password: string}[];
  const updateAdmin = db.prepare("UPDATE admins SET password = ? WHERE email = ?");
  for (const admin of admins) {
    if (!admin.password.startsWith('$argon2id$')) {
      const hashed = await Bun.password.hash(admin.password);
      updateAdmin.run(hashed, admin.email);
    }
  }
} catch (e) {
  console.error("Admin password migration error:", e);
}

export default db;
