import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL || "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_e2e_test";
console.log("Resetting database:", databaseUrl);

const sql = new SQL(databaseUrl);

async function reset() {
  try {
    // Drop all tables
    await sql.unsafe(`
      DROP TABLE IF EXISTS loan_payments CASCADE;
      DROP TABLE IF EXISTS loans CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS members CASCADE;
      DROP TABLE IF EXISTS admins CASCADE;
      DROP TABLE IF EXISTS settings CASCADE;
      DROP TABLE IF EXISTS token_blacklist CASCADE;
      DROP TABLE IF EXISTS rate_limits CASCADE;
      DROP TABLE IF EXISTS schema_migrations CASCADE;
    `);
    console.log("All tables dropped.");
  } catch (error) {
    console.error("Error dropping tables:", error);
  } finally {
    await sql.end();
  }

  // Now import db.ts to recreate and seed the database
  // We need to set the DATABASE_URL so db.ts uses the e2e test database
  process.env.DATABASE_URL = databaseUrl;
  console.log("Reinitializing database schema and seed data...");
  const db = (await import("../server/db")).default;
  await db.close();
  console.log("Database reset complete.");
}

await reset();
