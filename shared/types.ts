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
}
