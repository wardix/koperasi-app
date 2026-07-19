import type { Migration } from "./types";
import { regenerateAllLoanInstallmentSchedules } from "../services/loanService";
import type { Db } from "../db";

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

/**
 * One-time data fix: rewrite loan_schedules with classical annuity amortization
 * (fixed installment, declining interest, rising principal).
 * Re-allocates existing loan_payments onto the new schedule rows.
 */
export function createRegenerateLoanSchedulesAnnuityMigration(db: AppDb): Migration {
  return {
    name: "0019_regenerate_loan_schedules_annuity",
    async up() {
      const result = await regenerateAllLoanInstallmentSchedules(db as Db);
      console.log(
        `[migration 0019] regenerated annuity schedules for ${result.processed} loan(s)`
      );
    },
  };
}
