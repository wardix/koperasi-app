import { expect, test, describe, beforeAll } from "bun:test";
import db from "../db";
import { applyAllMigrations, listAppliedMigrations, runMigrations } from "./index";
import type { Migration } from "./types";

describe("formal migrations", () => {
  beforeAll(async () => {
    // Other suites may TRUNCATE schema_migrations; re-apply is idempotent for pending only.
    await applyAllMigrations(db);
  });

  test("baseline and data migrations are recorded", async () => {
    const applied = await listAppliedMigrations(db);
    expect(applied).toContain("001_baseline");
    expect(applied).toContain("0003_convert_currency_to_int");
    expect(applied).toContain("0004_hash_admin_passwords");
  });

  test("core tables exist after baseline", async () => {
    // Smoke-check: simple selects must not throw
    await db.query("SELECT 1 FROM members LIMIT 1").all();
    await db.query("SELECT 1 FROM loans LIMIT 1").all();
    await db.query("SELECT 1 FROM loan_payments LIMIT 1").all();
    await db.query("SELECT 1 FROM transactions LIMIT 1").all();
    await db.query("SELECT 1 FROM admins LIMIT 1").all();
    await db.query("SELECT 1 FROM settings LIMIT 1").all();
  });

  test("failed migration is not recorded and error propagates", async () => {
    const name = `test_fail_${crypto.randomUUID()}`;
    const failing: Migration = {
      name,
      async up() {
        throw new Error("intentional migration failure");
      },
    };

    await expect(runMigrations(db, [failing])).rejects.toThrow("intentional migration failure");

    const applied = await listAppliedMigrations(db);
    expect(applied).not.toContain(name);
  });
});
