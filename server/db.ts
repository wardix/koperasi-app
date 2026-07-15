import { SQL } from "bun";
import { AsyncLocalStorage } from "node:async_hooks";
import type { z } from "zod";
import { applyAllMigrations } from "./migrations";
import { runSeed } from "./seed";
import { mapRow, mapRows } from "./db/mapRow";

const sql = new SQL(process.env.DATABASE_URL || "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_test");

/** Active transactional client (same connection that issued BEGIN). */
const txStorage = new AsyncLocalStorage<SQL>();

function getSql(): SQL {
  return txStorage.getStore() ?? sql;
}

/**
 * Typed prepared statement wrapper over Bun SQL.
 *
 * Prefer generics or Zod parsers over `as any`:
 *   await db.query("SELECT * FROM members WHERE id = ?").get<MemberRow>(id)
 *   await db.query("SELECT * FROM members WHERE id = ?").getAs(memberRowSchema, id)
 */
export class Statement {
  queryStr: string;
  constructor(queryStr: string) {
    this.queryStr = queryStr;
  }

  getPgQuery() {
    let i = 1;
    return this.queryStr.replace(/\?/g, () => "$" + i++);
  }

  /** @deprecated Use mapRow from ./db/mapRow — kept for tests that introspect Statement. */
  mapRow(row: Record<string, unknown> | null) {
    return mapRow(row);
  }

  async get<T = Record<string, unknown>>(...args: unknown[]): Promise<T | null> {
    const rows = await getSql().unsafe(this.getPgQuery(), args as never[]);
    if (!rows || rows.length === 0) return null;
    return mapRow<T>(rows[0] as Record<string, unknown>);
  }

  async all<T = Record<string, unknown>>(...args: unknown[]): Promise<T[]> {
    const res = await getSql().unsafe(this.getPgQuery(), args as never[]);
    return mapRows<T>(Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
  }

  /** Fetch one row and parse with a Zod schema (coerces numbers, etc.). */
  async getAs<S extends z.ZodTypeAny>(
    schema: S,
    ...args: unknown[]
  ): Promise<z.infer<S> | null> {
    const row = await this.get<Record<string, unknown>>(...args);
    if (!row) return null;
    return schema.parse(row);
  }

  /** Fetch all rows and parse each with a Zod schema. */
  async allAs<S extends z.ZodTypeAny>(
    schema: S,
    ...args: unknown[]
  ): Promise<Array<z.infer<S>>> {
    const rows = await this.all<Record<string, unknown>>(...args);
    return rows.map((r) => schema.parse(r));
  }

  async run(...args: unknown[]): Promise<void> {
    await getSql().unsafe(this.getPgQuery(), args as never[]);
  }
}

export type Db = {
  query: (q: string) => Statement;
  prepare: (q: string) => Statement;
  run: (q: string, args?: unknown[]) => Promise<void>;
  transaction: <TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult> | TResult
  ) => (...args: TArgs) => Promise<TResult>;
  close: () => Promise<void> | void;
};

const db: Db = {
  query: (q: string) => new Statement(q),
  prepare: (q: string) => new Statement(q),
  run: async (q: string, args: unknown[] = []) => {
    await new Statement(q).run(...args);
  },
  /**
   * Run work inside a real Postgres transaction on one reserved connection.
   * Keeps the historical call shape: `await db.transaction(async () => { ... })()`.
   * Nested calls reuse the outer transaction (no nested BEGIN).
   */
  transaction: <TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult> | TResult
  ) => {
    return async (...args: TArgs): Promise<TResult> => {
      const existing = txStorage.getStore();
      if (existing) {
        return await cb(...args);
      }
      return await sql.begin(async (tx) => {
        return await txStorage.run(tx as unknown as SQL, async () => {
          return await cb(...args);
        });
      });
    };
  },
  close: () => sql.end(),
};

// ---------------------------------------------------------------------------
// Schema via formal migrations (server/migrations) — fail-fast, no swallow.
// Seed is separate (server/seed.ts).
// ---------------------------------------------------------------------------

await applyAllMigrations(db);
await runSeed(db);

export default db;
export { mapRow, mapRows, COLUMN_KEY_MAP, CAMEL_CASE_FIELDS } from "./db/mapRow";
export * from "./db/entities";
