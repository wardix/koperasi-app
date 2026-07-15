/**
 * Centralized Postgres → app key mapping.
 *
 * Unquoted identifiers in CREATE TABLE/SQL are folded to lowercase by Postgres
 * (`memberId` → `memberid`). App code expects camelCase. This map is derived
 * from known schema field names (see entities.ts + migrations), not an ad-hoc
 * list buried inside Statement.
 *
 * snake_case columns (google_id, created_at, …) are left unchanged.
 * Quoted aliases ("memberName") already arrive mixed-case and pass through.
 */

/** Canonical camelCase column / alias names used across the schema. */
export const CAMEL_CASE_FIELDS = [
  // members
  "joinDate",
  "simpananPokok",
  "simpananWajib",
  "simpananSukarela",
  "totalSavings",
  // transactions
  "memberId",
  "balanceBefore",
  "balanceAfter",
  "createdAt",
  "createdBy",
  "memberName",
  // loans
  "interestRate",
  "monthlyPayment",
  "interestAmount",
  "totalAmount",
  "approvedAt",
  "scheduleGenerated",
  "totalInstallments",
  "paidInstallments",
  "paidAmount",
  // loan_payments / cashflow aliases
  "loanId",
  "paymentDate",
  "paymentAmount",
  "principalAmount",
  "borrowerName",
  "partyName",
  "flowType",
  // loan_schedules
  "installmentNo",
  "dueDate",
  "lateFee",
  "paidAt",
  "updatedAt",
  "oldestOverdueDate",
  "oldestDueDate",
  // shu
  "biayaOperasional",
  "shuNetto",
  "closedAt",
  "closedBy",
  "savingsShare",
  "loansShare",
  "totalSHU",
  // reports / reconciliation aliases
  "totalMembers",
  "activeMembers",
  "passiveMembers",
  "totalPokok",
  "totalWajib",
  "totalSukarela",
  "totalLoansCount",
  "totalLoansAmount",
  "activeLoansAmount",
  "badLoansAmount",
  "paidLoansAmount",
  "totalPaymentsReceived",
  "dbTotalSavings",
  "calculatedTotal",
  "memberName",
] as const;

/** lowercase postgres key → camelCase app key */
export const COLUMN_KEY_MAP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CAMEL_CASE_FIELDS.map((f) => [f.toLowerCase(), f]))
);

/**
 * Map a raw Postgres row to app-facing keys.
 * - known camelCase fields restored via COLUMN_KEY_MAP
 * - already mixed-case / snake_case keys left as-is
 */
export function mapRow<T = Record<string, unknown>>(
  row: Record<string, unknown> | null | undefined
): T | null {
  if (!row) return null;
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    mapped[COLUMN_KEY_MAP[k] ?? k] = v;
  }
  return mapped as T;
}

export function mapRows<T = Record<string, unknown>>(
  rows: Array<Record<string, unknown>> | null | undefined
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapRow<T>(r)!);
}
