export interface DashboardData {
  activeMembers: string;
  totalSavings: number;
  /** Outstanding remaining principal (Disetujui + Macet, after payments) */
  totalLoans: number;
  /**
   * Original principal of approved/outstanding loans (status Disetujui + Macet).
   * Distinct from totalLoans which is remaining balance.
   */
  approvedLoansAmount: number;
  /** Count of loans with status Disetujui or Macet */
  approvedLoansCount: number;
  npl: string;
  roleData: Array<{label: string; value: number; color: string}>;
  purposeData: Array<{label: string; value: number; color: string}>;
  monthlyData: Array<{label: string; simpanan: number; pinjaman: number}>;
  recentActivities: Array<{id: string; activity: string; name: string; amount: number; date: string}>;
}

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'master' | 'financial' | 'reports' | 'system';
}

export interface CompanyEmployee {
  id: string;
  nip: string;
  nik?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  baseSalary: number;
  memberId?: string | null;
  isMember: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  contractEndDate?: string | null;
  coopLoanDeduction?: number;
  effectiveSalary?: number;
  dailyAccumulatedLimit?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EWARequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeNip?: string;
  isMember?: boolean;
  periodMonth: string;
  salaryBasis: number;
  maxLimit: number;
  amountRequested: number;
  feePercentage: number;
  feeAmount: number;
  disbursedAmount: number;
  totalPayrollDeduction: number;
  destinationBank?: string | null;
  destinationAccount?: string | null;
  destinationName?: string | null;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED' | 'PAID_SETTLED' | 'CANCELLED';
  rejectionReason?: string | null;
  disbursedAt?: string | null;
  disbursedBy?: string | null;
  settledAt?: string | null;
  createdAt: string;
}

export interface EwaQuotaInfo {
  employeeId: string;
  employeeName: string;
  isMember: boolean;
  periodMonth: string;
  baseSalary: number;
  coopLoanDeduction?: number; // Tagihan angsuran pinjaman koperasi bulan ini
  effectiveSalary?: number;   // Gaji bersih setelah dikurangi angsuran pinjaman koperasi
  maxAllowedPercentage: number; // 50
  maxMonthlyLimit: number; // Plafon sebulan penuh (50% dari effectiveSalary)
  currentDay?: number; // Tanggal ke-d hari ini (1..31)
  totalDaysInMonth?: number; // Total hari dalam bulan ini (28..31)
  progressivePercentage?: number; // Persentase progresif harian (e.g. 32.26%)
  dailyAccumulatedLimit?: number; // Plafon maksimal akumulatif progresif s/d hari ini
  totalUsedThisMonth: number;
  remainingQuota: number; // Sisa kuota yang dapat diajukan hari ini (dailyAccumulatedLimit - totalUsedThisMonth)
  feePercentage: number; // e.g. 2.0% (member) vs 3.5% (non-member)
  isEligible?: boolean;
  ineligibilityReason?: string | null;
  contractEndDate?: string | null;
}

export interface MemberRow {
  id: string;
  name: string;
  role: 'Anggota' | 'Ketua' | 'Bendahara' | 'Sekretaris' | 'Admin' | string;
  status: 'Aktif' | 'Pasif' | string;
  joinDate: string;
  /** Nomor Induk Kependudukan (16 digit), optional */
  nik?: string | null;
  /** Nomor telepon / HP, optional */
  phone?: string | null;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  totalSavings: number;
  /** Portal login email (no password returned) */
  email?: string | null;
  /** Whether a portal password is set */
  hasPortalAccess?: boolean;
}

export interface LoanRow {
  id: string;
  memberId: string;
  name: string;
  amount: number;
  tenor: number;
  purpose: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Lunas';
  paidAmount?: number;
  interestAmount?: number;
  totalAmount?: number;
  /** Snapshot admin fee / interest rate (% p.a.) at approval */
  interestRate?: number | null;
  monthlyPayment?: number | null;
  /** Application / loan date (ISO) — set from loanDate on create */
  createdAt?: string;
  /** Disbursement / approval timestamp (ISO) */
  approvedAt?: string;
  /** Supporting document attachment URL */
  attachmentUrl?: string | null;
  /** Supporting document attachment original file name */
  attachmentName?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SettingsData {
  koperasiName?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  bungaPinjaman?: string;
  bungaSimpanan?: string;
  denda?: string;
  viewReports?: string | boolean;
  selfRegister?: string | boolean;
  ssoAutoRegister?: string | boolean;
}

export interface SavingsTransactionRow {
  id: string;
  memberId: string;
  memberName?: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  createdBy: string;
}

export interface LoanPaymentRow {
  id: string;
  loanId: string;
  borrowerName?: string;
  amount: number;
  paymentDate: string;
  method: string;
  type?: 'pencairan' | 'angsuran';
}

export interface CashflowRow {
  source: 'savings' | 'loan_payment' | 'loan_disbursement' | 'expense';
  id: string;
  date: string;
  partyName?: string;
  description: string;
  amount: number;
  flowType: 'inflow' | 'outflow';
}

export type ExpenseCategory =
  | 'notaris'
  | 'atk'
  | 'sewa'
  | 'utilitas'
  | 'gaji'
  | 'transport'
  | 'pajak'
  | 'lainnya';

export interface ExpenseRow {
  id: string;
  expenseDate: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  paymentMethod: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface CashflowResponse {
  data: CashflowRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalInflow: number;
    totalOutflow: number;
    netCash: number;
  };
}

export interface NplRow {
  id: string;
  memberId: string;
  name: string;
  amount: number;
  tenor: number;
  purpose: string;
  status: string;
  paidAmount: number;
  interestAmount: number;
  totalAmount: number;
  remainingAmount: number;
  dpd?: number;
  agingBucket?: string;
  collectibility?: string;
  oldestOverdueDate?: string | null;
  createdAt?: string;
}

export interface NplResponse {
  data: NplRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalBadPrincipal: number;
    totalActivePrincipal: number;
    nplRatio: number;
    badAccountsCount: number;
    agingBuckets?: Record<string, number>;
  };
}

export interface ReportData {
  members: {
    totalMembers: number;
    activeMembers: number;
    passiveMembers: number;
    totalPokok: number;
    totalWajib: number;
    totalSukarela: number;
    totalSavings: number;
  };
  loans: {
    totalLoansCount: number;
    totalLoansAmount: number;
    activeLoansAmount: number;
    badLoansAmount: number;
    paidLoansAmount: number;
    totalPaymentsReceived: number;
  };
  timestamp: string;
}
