import type { Migration } from "./types";

type DbLike = {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
  transaction: <TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult> | TResult
  ) => (...args: TArgs) => Promise<TResult>;
};

/**
 * Formal forward-only migration runner.
 * - Ensures schema_migrations exists
 * - Runs each pending migration in its own transaction
 * - Records the name only after a successful up()
 * - Propagates errors (fail-fast; no silent skip)
 */
export async function runMigrations(db: DbLike, migrations: Migration[]): Promise<string[]> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const appliedRows = (await db.query("SELECT name FROM schema_migrations").all()) as {
    name: string;
  }[];
  const applied = new Set(appliedRows.map((r) => r.name));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    await db.transaction(async () => {
      await migration.up();
      await db.run("INSERT INTO schema_migrations (name) VALUES (?)", [migration.name]);
    })();

    applied.add(migration.name);
    newlyApplied.push(migration.name);
  }

  return newlyApplied;
}

export async function listAppliedMigrations(db: DbLike): Promise<string[]> {
  const rows = (await db.query("SELECT name FROM schema_migrations ORDER BY id").all()) as {
    name: string;
  }[];
  return rows.map((r) => r.name);
}
