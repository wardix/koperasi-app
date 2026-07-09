export interface DashboardData {
  activeMembers: string;
  totalSavings: number;
  totalLoans: number;
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
  twoFactor?: string | boolean;
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
  source: 'savings' | 'loan_payment' | 'loan_disbursement';
  id: string;
  date: string;
  partyName?: string;
  description: string;
  amount: number;
  flowType: 'inflow' | 'outflow';
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
