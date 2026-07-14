/**
 * Optional seed helpers. Runtime bootstrap still calls seedDefaults() from db.ts
 * so the API can start with a default admin + settings when tables are empty.
 *
 * Demo members/loans are only seeded when NODE_ENV=test (or SEED_DEMO=true).
 */

type AppDb = {
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
  prepare: (q: string) => { run: (...args: unknown[]) => Promise<void> };
};

export async function seedDefaults(db: AppDb): Promise<void> {
  const adminCount = (await db.query("SELECT COUNT(*) as count FROM admins").get()) as {
    count: number | string;
  };
  if (Number(adminCount.count) === 0) {
    const insert = db.prepare(
      "INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)"
    );
    const hashedPassword = await Bun.password.hash("admin123");
    await insert.run("1", "admin@koperasi.com", hashedPassword, "superadmin");
  }

  const hasKoperasiName = await db.query("SELECT 1 FROM settings WHERE key = 'koperasiName'").get();
  if (!hasKoperasiName) {
    const insertSetting = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING"
    );
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
}

export async function seedDemoData(db: AppDb): Promise<void> {
  const memberCount = (await db.query("SELECT COUNT(*) as count FROM members").get()) as {
    count: number | string;
  };
  if (Number(memberCount.count) !== 0) {
    return;
  }

  const insert = db.prepare(
    "INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?)"
  );
  await insert.run("1", "Budi Santoso", "Ketua", "Aktif", "01 Jan 2024", 5000000);
  await insert.run("2", "Siti Aminah", "Bendahara", "Aktif", "15 Feb 2024", 3500000);
  await insert.run("3", "Dewi Lestari", "Anggota", "Aktif", "20 Mar 2024", 2000000);
  await insert.run("4", "Joko Widodo", "Anggota", "Pasif", "10 Apr 2024", 1000000);

  const insertLoan = db.prepare(
    "INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  await insertLoan.run("1", "1", "Budi Santoso", 5000000, 12, "Modal Usaha Warung", "Menunggu");
  await insertLoan.run("2", "2", "Siti Aminah", 2500000, 6, "Biaya Pendidikan", "Menunggu");
  await insertLoan.run("3", "3", "Dewi Lestari", 10000000, 24, "Renovasi Rumah", "Disetujui");
}

export async function runSeed(db: AppDb): Promise<void> {
  await seedDefaults(db);
  const seedDemo =
    process.env.NODE_ENV === "test" ||
    process.env.SEED_DEMO === "true" ||
    Bun.env.SEED_DEMO === "true";
  if (seedDemo) {
    await seedDemoData(db);
  }
}
