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

export interface MemberRow {
  id: string;
  name: string;
  role: 'Anggota' | 'Ketua' | 'Bendahara' | 'Sekretaris' | 'Admin' | string;
  status: 'Aktif' | 'Pasif' | string;
  joinDate: string;
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
  /** Application / loan date (ISO) — set from loanDate on create */
  createdAt?: string;
  /** Disbursement / approval timestamp (ISO) */
  approvedAt?: string;
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
