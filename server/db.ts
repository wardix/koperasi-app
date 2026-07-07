import { Database } from "bun:sqlite";

// Create or open the SQLite database file
const db = new Database("koperasi.sqlite", { create: true });

// Initialize schema if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    joinDate TEXT NOT NULL,
    totalSavings INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    tenor TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Insert initial seed data if table is empty
const memberCount = db.query("SELECT COUNT(*) as count FROM members").get() as { count: number };
if (memberCount.count === 0) {
  const insert = db.prepare("INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("1", "Budi Santoso", "Ketua", "Aktif", "01 Jan 2024", 5000000);
  insert.run("2", "Siti Aminah", "Bendahara", "Aktif", "15 Feb 2024", 3500000);
  insert.run("3", "Joko Widodo", "Anggota", "Pasif", "10 Mar 2024", 1000000);
}

const loanCount = db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number };
if (loanCount.count === 0) {
  const insertLoan = db.prepare("INSERT INTO loans (id, name, amount, tenor, purpose, status) VALUES (?, ?, ?, ?, ?, ?)");
  insertLoan.run("1", "Budi Santoso", 5000000, "12 Bulan", "Modal Usaha Warung", "Menunggu");
  insertLoan.run("2", "Siti Aminah", 2500000, "6 Bulan", "Biaya Pendidikan", "Menunggu");
  insertLoan.run("3", "Dewi Lestari", 10000000, "24 Bulan", "Renovasi Rumah", "Disetujui");
}

const adminCount = db.query("SELECT COUNT(*) as count FROM admins").get() as { count: number };
if (adminCount.count === 0) {
  const insertAdmin = db.prepare("INSERT INTO admins (email, password) VALUES (?, ?)");
  insertAdmin.run("admin@koperasi.com", "admin123");
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

export default db;
