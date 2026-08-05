import type { Migration } from "./types";
import { createBaselineMigration } from "./001_baseline";
import { createConvertCurrencyMigration } from "./0003_convert_currency_to_int";
import { createHashAdminPasswordsMigration } from "./0004_hash_admin_passwords";
import { createLoanTermSnapshotsMigration } from "./0008_loan_term_snapshots";
import { createLoanSchedulesMigration } from "./0009_add_loan_schedules";
import { createShuClosingMigration } from "./0010_shu_configurable_and_closing";
import { createSavingsConstraintsMigration } from "./0011_add_savings_constraints";
import { createAddAuditLogsMigration } from "./0012_add_audit_logs";
import { createAddTotp2FaMigration } from "./0013_add_totp_2fa";
import { createAddJTiBlacklistMigration } from "./0014_add_jti_blacklist";
import { createSoftDeleteMigration } from "./0015_soft_delete";
import { createMigration as createAddMemberLoginMigration } from "./0016_add_member_login";
import { createMigration as createAddNotificationLogsMigration } from "./0017_add_notification_logs";
import { createAddExpensesMigration } from "./0018_add_expenses";
import { createRegenerateLoanSchedulesAnnuityMigration } from "./0019_regenerate_loan_schedules_annuity";
import { createAddMemberNikMigration } from "./0020_add_member_nik";
import { createAddMemberPhoneMigration } from "./0021_add_member_phone";
import { createAddAccountingMigration } from "./0022_add_accounting";
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
    createLoanTermSnapshotsMigration(db),
    createLoanSchedulesMigration(db),
    createShuClosingMigration(db),
    createSavingsConstraintsMigration(db),
    createAddAuditLogsMigration(db),
    createAddTotp2FaMigration(db),
    createAddJTiBlacklistMigration(db),
    createSoftDeleteMigration(db),
    createAddMemberLoginMigration(db),
    createAddNotificationLogsMigration(db),
    createAddExpensesMigration(db),
    createRegenerateLoanSchedulesAnnuityMigration(db),
    createAddMemberNikMigration(db),
    createAddMemberPhoneMigration(db),
    createAddAccountingMigration(db),
  ];
}

export async function applyAllMigrations(db: AppDb): Promise<string[]> {
  return runMigrations(db, buildMigrations(db));
}

export { listAppliedMigrations, runMigrations };
export type { Migration };
