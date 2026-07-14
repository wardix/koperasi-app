import type { Migration } from "./types";
import { createBaselineMigration } from "./001_baseline";
import { createConvertCurrencyMigration } from "./0003_convert_currency_to_int";
import { createHashAdminPasswordsMigration } from "./0004_hash_admin_passwords";
import { runMigrations, listAppliedMigrations } from "./runner";

type AppDb = {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => {
    get: (...args: unknown[]) => Promise<unknown>;
    all: (...args: unknown[]) => Promise<unknown[]>;
  };
  prepare: (q: string) => { run: (...args: unknown[]) => Promise<void> };
  transaction: <TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult> | TResult
  ) => (...args: TArgs) => Promise<TResult>;
};

/** Ordered forward-only migrations for this app. */
export function buildMigrations(db: AppDb): Migration[] {
  return [
    createBaselineMigration(db),
    createConvertCurrencyMigration(db),
    createHashAdminPasswordsMigration(db),
  ];
}

export async function applyAllMigrations(db: AppDb): Promise<string[]> {
  return runMigrations(db, buildMigrations(db));
}

export { listAppliedMigrations, runMigrations };
export type { Migration };
