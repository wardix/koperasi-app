/**
 * Typed DB entities and Zod row parsers.
 *
 * Core table shapes used across route → service → db. Prefer these types
 * (or Pick/Partial of them) instead of `as any` on query results.
 *
 * Runtime parsing is optional: use Statement.getAs/allAs when you want
 * coercion/validation; use get<T>/all<T> for compile-time typing only.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers — Postgres / Bun may return bigint-ish values as string or number
// ---------------------------------------------------------------------------

const num = z.coerce.number();
const numNull = z.coerce.number().nullable().optional();
const str = z.string();
const strNull = z.string().nullable().optional();
const bool = z.coerce.boolean();

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberRowSchema = z.object({
  id: str,
  name: str,
  role: str,
  status: str,
  joinDate: str,
  simpananPokok: num.default(0),
  simpananWajib: num.default(0),
  simpananSukarela: num.default(0),
  totalSavings: num,
  /** Nomor Induk Kependudukan (16 digit), optional */
  nik: strNull,
  /** Nomor telepon / HP, optional */
  phone: strNull,
  email: strNull,
  password: strNull,
  deletedAt: strNull,
});
export type MemberRow = z.infer<typeof memberRowSchema>;

export const memberSavingsColsSchema = memberRowSchema.pick({
  simpananPokok: true,
  simpananWajib: true,
  simpananSukarela: true,
  totalSavings: true,
});
export type MemberSavingsCols = z.infer<typeof memberSavingsColsSchema>;

// ---------------------------------------------------------------------------
// Transactions (savings mutations)
// ---------------------------------------------------------------------------

export const transactionRowSchema = z.object({
  id: str,
  memberId: strNull,
  type: str,
  amount: num,
  balanceBefore: num,
  balanceAfter: num,
  createdAt: str,
  createdBy: str,
  memberName: strNull,
});
export type TransactionRow = z.infer<typeof transactionRowSchema>;

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export const loanRowSchema = z.object({
  id: str,
  memberId: str,
  name: str,
  amount: num,
  tenor: z.union([num, str]),
  purpose: str,
  status: str,
  createdAt: strNull,
  interestRate: numNull,
  monthlyPayment: numNull,
  interestAmount: numNull,
  totalAmount: numNull,
  approvedAt: strNull,
  scheduleGenerated: bool.optional().nullable(),
  totalInstallments: numNull,
  paidInstallments: numNull,
  paidAmount: numNull,
  oldestOverdueDate: strNull,
  deletedAt: strNull,
  attachmentUrl: strNull.optional(),
  attachmentName: strNull.optional(),
});
export type LoanRow = z.infer<typeof loanRowSchema>;

// ---------------------------------------------------------------------------
// Loan payments & schedules
// ---------------------------------------------------------------------------

export const loanPaymentRowSchema = z.object({
  id: str,
  loanId: str,
  amount: num,
  paymentDate: str,
  method: str,
  type: z.enum(["pencairan", "angsuran"]).optional(),
  borrowerName: strNull,
});
export type LoanPaymentRow = z.infer<typeof loanPaymentRowSchema>;

export const loanScheduleRowSchema = z.object({
  id: str,
  loanId: str,
  installmentNo: num,
  dueDate: str,
  principalAmount: num,
  interestAmount: num,
  paidAmount: num.default(0),
  status: str,
  lateFee: num.default(0),
  paidAt: strNull,
  createdAt: strNull,
  updatedAt: strNull,
});
export type LoanScheduleRow = z.infer<typeof loanScheduleRowSchema>;

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export const adminRowSchema = z.object({
  id: str,
  email: str,
  password: str.optional(),
  role: str,
  google_id: strNull,
  name: strNull,
  avatar_url: strNull,
  auth_provider: strNull,
  totp_secret: strNull,
  two_factor_enabled: bool.optional().nullable(),
  recovery_codes: strNull,
});
export type AdminRow = z.infer<typeof adminRowSchema>;

/** Safe admin projection (no password / secrets). */
export const adminPublicSchema = adminRowSchema.omit({
  password: true,
  totp_secret: true,
  recovery_codes: true,
});
export type AdminPublic = z.infer<typeof adminPublicSchema>;

// ---------------------------------------------------------------------------
// Settings, aggregates, audit, SHU
// ---------------------------------------------------------------------------

export const settingRowSchema = z.object({
  key: str,
  value: str,
});
export type SettingRow = z.infer<typeof settingRowSchema>;

export const countRowSchema = z.object({ count: num });
export type CountRow = z.infer<typeof countRowSchema>;

export const sumRowSchema = z.object({ s: numNull });
export type SumRow = z.infer<typeof sumRowSchema>;

export const totalRowSchema = z.object({ total: numNull });
export type TotalRow = z.infer<typeof totalRowSchema>;

export const paidSumSchema = z.object({ paid: numNull });
export type PaidSum = z.infer<typeof paidSumSchema>;

export const rateLimitRowSchema = z.object({ count: num });
export type RateLimitRow = z.infer<typeof rateLimitRowSchema>;

export const auditLogRowSchema = z.object({
  id: str,
  actor: str,
  action: str,
  entity: str,
  entity_id: strNull,
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  ip: strNull,
  created_at: z.unknown().optional(),
});
export type AuditLogRow = z.infer<typeof auditLogRowSchema>;

export const auditActionCountSchema = z.object({
  action: str,
  count: num,
});
export type AuditActionCount = z.infer<typeof auditActionCountSchema>;

export const shuCloseRowSchema = z.object({
  year: str,
  pendapatan: num,
  biayaOperasional: num,
  shuNetto: num,
  distribusi: z.unknown(),
  closedAt: strNull,
  closedBy: strNull,
});
export type ShuCloseRow = z.infer<typeof shuCloseRowSchema>;

export const shuAllocationRowSchema = z.object({
  year: str,
  memberId: str,
  savingsShare: num,
  loansShare: num,
  totalSHU: num,
  name: strNull,
  totalSavings: numNull,
});
export type ShuAllocationRow = z.infer<typeof shuAllocationRowSchema>;

export const cashflowRowSchema = z.object({
  source: z.enum(["savings", "loan_payment", "loan_disbursement", "expense", "journal"]),
  id: str,
  date: str,
  partyName: strNull,
  description: str,
  amount: num,
  flowType: z.enum(["inflow", "outflow"]),
});
export type CashflowRow = z.infer<typeof cashflowRowSchema>;

export const reportMembersStatsSchema = z.object({
  totalMembers: numNull,
  activeMembers: numNull,
  passiveMembers: numNull,
  totalPokok: numNull,
  totalWajib: numNull,
  totalSukarela: numNull,
  totalSavings: numNull,
});
export type ReportMembersStats = z.infer<typeof reportMembersStatsSchema>;

export const reportLoansStatsSchema = z.object({
  totalLoansCount: numNull,
  totalLoansAmount: numNull,
  activeLoansAmount: numNull,
  badLoansAmount: numNull,
  paidLoansAmount: numNull,
});
export type ReportLoansStats = z.infer<typeof reportLoansStatsSchema>;

export const interestPaymentRowSchema = z.object({
  paymentAmount: numNull,
  principalAmount: numNull,
  tenor: z.union([num, str]).optional(),
  paymentDate: strNull,
  memberId: strNull,
});
export type InterestPaymentRow = z.infer<typeof interestPaymentRowSchema>;

export const groupCountSchema = z.object({
  role: str.optional(),
  purpose: str.optional(),
  count: num,
  bucket: str.optional(),
});
export type GroupCount = z.infer<typeof groupCountSchema>;

export const monthTotalSchema = z.object({
  month: str,
  total: numNull,
});
export type MonthTotal = z.infer<typeof monthTotalSchema>;

// ---------------------------------------------------------------------------
// Accounting (General Ledger)
// ---------------------------------------------------------------------------

export const accountRowSchema = z.object({
  id: str,
  code: str,
  name: str,
  type: str,
  normal_balance: str,
  is_active: bool.default(true),
  created_at: strNull,
});
export type AccountRow = z.infer<typeof accountRowSchema>;

export const journalEntryRowSchema = z.object({
  id: str,
  transaction_date: str,
  description: str,
  reference_type: strNull,
  reference_id: strNull,
  created_by: strNull,
  created_at: strNull,
});
export type JournalEntryRow = z.infer<typeof journalEntryRowSchema>;

export const journalLineRowSchema = z.object({
  id: str,
  journal_entry_id: str,
  account_id: str,
  debit: num.default(0),
  credit: num.default(0),
  description: strNull,
});
export type JournalLineRow = z.infer<typeof journalLineRowSchema>;

// ---------------------------------------------------------------------------
// Voluntary Savings Withdrawals
// ---------------------------------------------------------------------------

export const savingsWithdrawalRowSchema = z.object({
  id: str,
  member_id: str,
  amount: num,
  destination_bank: str,
  destination_account: str,
  destination_name: str,
  notes: strNull,
  status: str.default("Menunggu"),
  payment_source_account_id: strNull,
  transaction_id: strNull,
  approved_by: strNull,
  approved_at: strNull,
  rejected_by: strNull,
  rejected_at: strNull,
  rejection_reason: strNull,
  created_at: str,
  updated_at: str,
});
export type SavingsWithdrawalRow = z.infer<typeof savingsWithdrawalRowSchema>;

// ---------------------------------------------------------------------------
// Savings Deposits (Transfer Confirmation)
// ---------------------------------------------------------------------------

export const savingsDepositRowSchema = z.object({
  id: str,
  member_id: str,
  savings_type: str,
  amount: num,
  transfer_date: str,
  sender_bank: strNull,
  sender_account: strNull,
  sender_name: strNull,
  proof_url: strNull,
  proof_name: strNull,
  notes: strNull,
  status: str.default("Menunggu"),
  payment_target_account_id: strNull,
  transaction_id: strNull,
  verified_by: strNull,
  verified_at: strNull,
  rejected_by: strNull,
  rejected_at: strNull,
  rejection_reason: strNull,
  created_at: str,
  updated_at: str,
});
export type SavingsDepositRow = z.infer<typeof savingsDepositRowSchema>;


