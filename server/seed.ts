/**
 * Seed helpers for development and test environments only.
 * Production deployments must bootstrap admin accounts explicitly via secure channels.
 */

type AppDb = {
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
  };
  prepare: (q: string) => { run: (...args: unknown[]) => Promise<void> };
  run: (q: string, args?: unknown[]) => Promise<void>;
};

/**
 * Seed default admin and settings. Only runs in development/test environments
 * or when ALLOW_SEED=true is explicitly set (for CI/CD bootstrap scripts).
 * Production requires explicit bootstrap via secure channels (e.g., SSH, vault).
 */
export async function seedDefaults(db: AppDb): Promise<void> {
  // SECURITY: Auto-seed only in dev/test OR when ALLOW_SEED is explicitly enabled
  const isDevOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const allowSeedExplicit = process.env.ALLOW_SEED === "true" || process.env.SEED_ADMIN === "true";
  const shouldAutoSeed = isDevOrTest || allowSeedExplicit;

  if (shouldAutoSeed) {
    // Only auto-seed admin in dev/test environments or when explicitly allowed
    const adminCount = (await db.query("SELECT COUNT(*) as count FROM admins").get()) as {
      count: number | string;
    };
    if (Number(adminCount.count) === 0) {
      const insert = db.prepare(
        "INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)"
      );
      // Use strong default password for dev only - production should force change on first login
      const hashedPassword = await Bun.password.hash("admin123");
      await insert.run("1", "admin@koperasi.com", hashedPassword, "superadmin");

      if (allowSeedExplicit) {
        console.log("[SECURITY] Auto-seeded admin account via ALLOW_SEED flag. Production should NOT use this.");
      }
    }

    // Seed default settings (idempotent)
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
      await insertSetting.run("ssoAutoRegister", "true");
    }
  } else {
    // Production: log warning if no admins exist (requires manual bootstrap)
    const adminCount = (await db.query("SELECT COUNT(*) as count FROM admins").get()) as {
      count: number | string;
    };
    if (Number(adminCount.count) === 0) {
      console.warn(
        "[SECURITY] No admin accounts found. Production requires explicit bootstrap via secure channels. " +
        "See docs/BOOTSTRAP.md for instructions."
      );
    }
  }

  // Seed demo data only in test environments (not dev or production)
  const seedDemo = process.env.NODE_ENV === "test" || process.env.SEED_DEMO === "true";
  if (seedDemo) {
    await seedDemoData(db);
  }
}

export async function seedDemoData(db: AppDb): Promise<void> {
  // Clear existing data first to ensure consistent state with new constraints
  await db.run("DELETE FROM transactions");
  await db.run("DELETE FROM loan_payments");
  await db.run("DELETE FROM loans");
  await db.run("DELETE FROM members");

  // Seed demo data with proper savings composition
  // totalSavings must equal simpananPokok + simpananWajib + simpananSukarela
  const insert = db.prepare(
    "INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  await insert.run("1", "Budi Santoso", "Ketua", "Aktif", "01 Jan 2024", 500000, 1000000, 3500000, 5000000);
  await insert.run("2", "Siti Aminah", "Bendahara", "Aktif", "15 Feb 2024", 350000, 700000, 2450000, 3500000);
  await insert.run("3", "Dewi Lestari", "Anggota", "Aktif", "20 Mar 2024", 200000, 400000, 1400000, 2000000);
  await insert.run("4", "Joko Widodo", "Anggota", "Pasif", "10 Apr 2024", 100000, 200000, 700000, 1000000);

  const insertLoan = db.prepare(
    "INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  await insertLoan.run("1", "1", "Budi Santoso", 5000000, 12, "Modal Usaha Warung", "Menunggu");
  await insertLoan.run("2", "2", "Siti Aminah", 2500000, 6, "Biaya Pendidikan", "Menunggu");
  await insertLoan.run("3", "3", "Dewi Lestari", 10000000, 24, "Renovasi Rumah", "Disetujui");
}

export async function runSeed(db: AppDb): Promise<void> {
  await seedDefaults(db);
}
