/**
 * Reset operational business data so you can re-enter members/transactions
 * from scratch. Keeps schema, admins, and settings by default.
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun run db:reset-data -- --confirm
 *
 * Options:
 *   --confirm              Required. Actually perform the wipe.
 *   --include-audit        Also truncate audit_logs
 *   --include-sessions     Also truncate token/rate-limit tables
 *   --dry-run              Print what would be truncated (still needs --confirm skipped... use without --confirm)
 *
 * Safety:
 *   - Refuses to run without --confirm
 *   - Refuses when NODE_ENV=production unless ALLOW_PROD_RESET=yes
 *   - Does NOT drop tables or touch schema_migrations / admins / settings
 */

import { SQL } from "bun";

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const includeAudit = args.has("--include-audit");
const includeSessions = args.has("--include-sessions");
const dryRun = args.has("--dry-run");

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://koperasi:koperasi_pass@localhost:5432/koperasi";

// Business data tables (child tables first is unnecessary with TRUNCATE CASCADE)
const businessTables = [
  "loan_payments",
  "loan_schedules",
  "loans",
  "transactions",
  "shu_member_allocations",
  "shu_closes",
  "notification_logs",
  "members",
] as const;

const optionalTables: string[] = [];
if (includeAudit) optionalTables.push("audit_logs");
if (includeSessions) {
  optionalTables.push("token_blacklist", "refresh_token_blacklist", "rate_limits");
}

const tablesToWipe = [...businessTables, ...optionalTables];

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function printUsage(): void {
  console.log(`
db:reset-data — wipe members + all transactions/loans (keep admins & settings)

  bun run db:reset-data -- --confirm
  bun run db:reset-data -- --confirm --include-audit
  bun run db:reset-data -- --confirm --include-sessions
  bun run db:reset-data -- --dry-run

Environment:
  DATABASE_URL          Postgres connection string (required in production)
  ALLOW_PROD_RESET=yes  Required when NODE_ENV=production
`);
}

async function countRows(sql: SQL, table: string): Promise<number | null> {
  try {
    const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM ${table}`);
    return Number(rows[0]?.n ?? 0);
  } catch {
    // Table may not exist on older DBs
    return null;
  }
}

async function existingTables(sql: SQL, names: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const name of names) {
    const rows = await sql.unsafe(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [name]
    );
    if (rows.length > 0) found.push(name);
  }
  return found;
}

async function main(): Promise<void> {
  if (args.has("--help") || args.has("-h")) {
    printUsage();
    process.exit(0);
  }

  const nodeEnv = process.env.NODE_ENV || "";
  if (nodeEnv === "production" && process.env.ALLOW_PROD_RESET !== "yes") {
    console.error(
      "[abort] NODE_ENV=production. Set ALLOW_PROD_RESET=yes if you really intend to wipe production data."
    );
    process.exit(1);
  }

  if (!confirm && !dryRun) {
    console.error("[abort] Missing --confirm (or use --dry-run to preview).");
    printUsage();
    process.exit(1);
  }

  console.log("Target database:", maskUrl(databaseUrl));
  console.log("NODE_ENV:", nodeEnv || "(unset)");
  console.log("Mode:", dryRun ? "DRY RUN" : "WIPE");
  console.log("Tables:", tablesToWipe.join(", "));
  console.log("Preserved: admins, settings, schema_migrations");

  const sql = new SQL(databaseUrl);

  try {
    await sql.unsafe("SELECT 1");
  } catch (err) {
    console.error("[abort] Cannot connect to database:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const present = await existingTables(sql, tablesToWipe);
  const missing = tablesToWipe.filter((t) => !present.includes(t));
  if (missing.length) {
    console.log("Skipping missing tables:", missing.join(", "));
  }
  if (present.length === 0) {
    console.error("[abort] None of the target tables exist.");
    await sql.end();
    process.exit(1);
  }

  console.log("\nRow counts BEFORE:");
  for (const table of present) {
    const n = await countRows(sql, table);
    console.log(`  ${table}: ${n === null ? "?" : n}`);
  }

  // Also show preserved tables for peace of mind
  for (const table of ["admins", "settings"] as const) {
    const n = await countRows(sql, table);
    if (n !== null) console.log(`  ${table} (kept): ${n}`);
  }

  if (dryRun) {
    console.log("\nDry run only — no data was deleted.");
    await sql.end();
    process.exit(0);
  }

  const quoted = present.map((t) => `"${t}"`).join(", ");
  console.log("\nTruncating…");
  await sql.unsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

  console.log("\nRow counts AFTER:");
  for (const table of present) {
    const n = await countRows(sql, table);
    console.log(`  ${table}: ${n === null ? "?" : n}`);
  }
  for (const table of ["admins", "settings"] as const) {
    const n = await countRows(sql, table);
    if (n !== null) console.log(`  ${table} (kept): ${n}`);
  }

  console.log("\nDone. You can re-enter members and transactions from a clean slate.");
  console.log("Tip: restart the app if dashboard stats look cached.");

  await sql.end();
}

await main();
