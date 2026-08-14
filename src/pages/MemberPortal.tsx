import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../utils/format';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useThemeMode } from '../contexts/ThemeContext';

const PREVIEW_TOKEN_KEY = 'memberPreviewToken';
const PREVIEW_NAME_KEY = 'memberPreviewName';
const PREVIEW_RETURN_KEY = 'memberPreviewReturn';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Google Identity Services (loaded via index.html)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement | null,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: string | number;
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

function readPortalToken(): string | null {
  return sessionStorage.getItem(PREVIEW_TOKEN_KEY) || localStorage.getItem('memberToken');
}

type PortalLoan = {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  createdAt: string;
  totalAmount?: number;
  monthlyPayment?: number;
  interestAmount?: number;
  tenor?: number;
};

type ScheduleRow = {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidAmount: number;
  status: string;
  lateFee?: number;
};

export default function MemberPortal() {
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();
  const isDark = mode === 'dark';
  const [isPreview] = useState(() => !!sessionStorage.getItem(PREVIEW_TOKEN_KEY));
  const [previewName] = useState(() => sessionStorage.getItem(PREVIEW_NAME_KEY) || '');
  const [memberToken, setMemberToken] = useState<string | null>(() => readPortalToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loans, setLoans] = useState<PortalLoan[]>([]);
  const [activeTab, setActiveTab] = useState<'savings' | 'loans' | 'reports'>('savings');
  const [selectedLoan, setSelectedLoan] = useState<PortalLoan | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [incomeData, setIncomeData] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const loadReports = async () => {
    const token = readPortalToken();
    if (!token) return;
    setReportsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [incRes, balRes] = await Promise.all([
        fetch('/api/v1/portal/reports/income-statement', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/reports/balance-sheet', { headers }).then((r) => r.json()),
      ]);
      if (incRes.success) setIncomeData(incRes.data);
      if (balRes.success) setBalanceData(balRes.data);
    } catch {
      setError('Gagal memuat laporan keuangan');
    } finally {
      setReportsLoading(false);
    }
  };

  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyTenor, setApplyTenor] = useState('12');
  const [applyPurpose, setApplyPurpose] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;
    setApplyLoading(true);
    setApplyError('');
    setApplySuccess('');
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch('/api/v1/portal/loans/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: parseFloat(applyAmount),
          tenor: parseInt(applyTenor, 10),
          purpose: applyPurpose,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setApplySuccess(res.message || 'Pengajuan pinjaman berhasil dikirim!');
        setApplyAmount('');
        setApplyPurpose('');
        loadData();
        setTimeout(() => {
          setShowApplyForm(false);
          setApplySuccess('');
        }, 2000);
      } else {
        setApplyError(res.message || 'Gagal mengajukan pinjaman');
      }
    } catch {
      setApplyError('Terjadi kesalahan jaringan');
    } finally {
      setApplyLoading(false);
    }
  };

  const clearPreviewSession = useCallback(() => {
    sessionStorage.removeItem(PREVIEW_TOKEN_KEY);
    sessionStorage.removeItem(PREVIEW_NAME_KEY);
    sessionStorage.removeItem(PREVIEW_RETURN_KEY);
  }, []);

  const exitPreview = useCallback(() => {
    const returnTo = sessionStorage.getItem(PREVIEW_RETURN_KEY) || '/members';
    clearPreviewSession();
    setMemberToken(null);
    setProfile(null);
    navigate(returnTo);
  }, [clearPreviewSession, navigate]);

  useEffect(() => {
    if (memberToken) {
      loadData();
    }
  }, [memberToken]);

  const loadData = async () => {
    const token = readPortalToken();
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, txRes, loansRes] = await Promise.all([
        fetch('/api/v1/portal/profile', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/savings/transactions', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/loans', { headers }).then((r) => r.json()),
      ]);

      if (profileRes.success) setProfile(profileRes.data);
      if (txRes.success) setTransactions(txRes.data || []);
      if (loansRes.success) {
        setLoans(loansRes.data || []);
      } else if (loansRes.message) {
        setError(loansRes.message || 'Gagal memuat data pinjaman');
      }
      if (!profileRes.success) {
        setError(profileRes.message || 'Sesi berakhir, silakan masuk lagi');
        if (sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
          clearPreviewSession();
        } else {
          localStorage.removeItem('memberToken');
        }
        setMemberToken(null);
      }
    } catch {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (loan: PortalLoan) => {
    const token = readPortalToken();
    if (!token) return;
    setSelectedLoan(loan);
    setScheduleLoading(true);
    setSchedule([]);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/v1/portal/loans/${loan.id}/schedule`, { headers }).then((r) =>
        r.json()
      );
      if (res.success) {
        setSchedule(res.data || []);
      } else {
        setError(res.message || 'Gagal memuat jadwal angsuran');
      }
    } catch {
      setError('Gagal memuat jadwal angsuran');
    } finally {
      setScheduleLoading(false);
    }
  };

  const completeMemberLogin = useCallback(
    (token: string) => {
      clearPreviewSession();
      localStorage.setItem('memberToken', token);
      setMemberToken(token);
      setError('');
    },
    [clearPreviewSession]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Real member login should not use preview session
      clearPreviewSession();
      const res = await fetch('/api/v1/member-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());

      if (res.success) {
        completeMemberLogin(res.data.token);
      } else {
        setError(res.message || 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setLoading(true);
      setError('');
      try {
        clearPreviewSession();
        const res = await fetch('/api/v1/member-auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        }).then((r) => r.json());

        if (res.success && res.data?.token) {
          completeMemberLogin(res.data.token);
        } else {
          setError(
            res.message ||
              'Email Google tidak terdaftar sebagai akses portal. Hubungi pengurus.'
          );
        }
      } catch {
        setError('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    },
    [clearPreviewSession, completeMemberLogin]
  );

  // Render Google Sign-In when showing the login form
  useEffect(() => {
    if (memberToken || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryRender = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !googleBtnRef.current) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(tryRender, 100);
        }
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'id',
      });
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [memberToken, handleGoogleCredential]);

  const handleLogout = () => {
    if (isPreview || sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
      exitPreview();
      return;
    }
    fetch('/api/v1/member-auth/logout', { method: 'POST' });
    localStorage.removeItem('memberToken');
    setMemberToken(null);
    setProfile(null);
    setSelectedLoan(null);
    setSchedule([]);
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--color-border-primary)',
    borderRadius: 'var(--radius-md, 6px)',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const scheduleCols: TableColumn<ScheduleRow>[] = useMemo(
    () => [
      {
        key: 'installmentNo',
        header: 'Cicilan',
        width: pixel(80),
        renderCell: (i) => <Text type="body">#{i.installmentNo}</Text>,
      },
      {
        key: 'dueDate',
        header: 'Jatuh Tempo',
        width: pixel(120),
        renderCell: (i) => (
          <Text type="body">{new Date(i.dueDate).toLocaleDateString('id-ID')}</Text>
        ),
      },
      {
        key: 'principalAmount',
        header: 'Pokok',
        width: pixel(110),
        renderCell: (i) => formatRp(i.principalAmount),
      },
      {
        key: 'interestAmount',
        header: 'Biaya Admin',
        width: pixel(110),
        renderCell: (i) => formatRp(i.interestAmount),
      },
      {
        key: 'paidAmount',
        header: 'Sudah Bayar',
        width: pixel(120),
        renderCell: (i) => formatRp(i.paidAmount || 0),
      },
      {
        key: 'status',
        header: 'Status',
        width: pixel(100),
        renderCell: (i) => {
          const variant =
            i.status === 'Paid' ? 'success' : i.status === 'Late' ? 'critical' : 'neutral';
          const label =
            i.status === 'Paid' ? 'Lunas' : i.status === 'Late' ? 'Terlambat' : 'Belum';
          return <Badge variant={variant} label={label} />;
        },
      },
    ],
    []
  );

  const remainingOnSchedule = useMemo(() => {
    return schedule.reduce((sum, row) => {
      const due =
        Number(row.principalAmount || 0) +
        Number(row.interestAmount || 0) +
        Number(row.lateFee || 0);
      const paid = Number(row.paidAmount || 0);
      return sum + Math.max(0, due - paid);
    }, 0);
  }, [schedule]);

  if (!memberToken) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background-subtle)',
          padding: 16,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 400, padding: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <IconButton
              label={isDark ? "Mode Terang" : "Mode Gelap"}
              icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
              variant="ghost"
              onClick={() => setMode(isDark ? 'light' : 'dark')}
            />
          </div>
          <VStack gap={6}>
            <Heading level={2} align="center">
              Portal Anggota
            </Heading>
            <Text type="body" color="secondary" align="center">
              Masuk untuk melihat simpanan, pinjaman, dan jadwal angsuran Anda.
            </Text>
            {error ? (
              <Text type="supporting" color="critical">
                {error}
              </Text>
            ) : null}

            {GOOGLE_CLIENT_ID ? (
              <VStack gap={3}>
                <div
                  ref={googleBtnRef}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: loading ? 0.6 : 1,
                    pointerEvents: loading ? 'none' : 'auto',
                  }}
                />
                <Text type="supporting" color="secondary" align="center">
                  Email Google harus sama dengan email portal yang didaftarkan pengurus.
                </Text>
                <HStack gap={2} vAlign="center" style={{ width: '100%' }}>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--color-border-primary)',
                    }}
                  />
                  <Text type="supporting" color="secondary">
                    atau
                  </Text>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--color-border-primary)',
                    }}
                  />
                </HStack>
              </VStack>
            ) : null}

            <form
              onSubmit={handleLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <VStack gap={2}>
                <Text type="supporting">ID Anggota / Email</Text>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </VStack>
              <VStack gap={2}>
                <Text type="supporting">Kata Sandi</Text>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  required
                />
              </VStack>
              <Button
                label={loading ? 'Memproses...' : 'Masuk'}
                type="submit"
                variant="primary"
                isDisabled={loading}
              />
            </form>

            <Text type="supporting" color="secondary" align="center">
              Pengurus koperasi?{' '}
              <a
                href="/login"
                style={{
                  color: 'var(--color-primary-500, #0171E3)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Login pengurus
              </a>
            </Text>
          </VStack>
        </Card>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  const txCols: TableColumn<any>[] = [
    {
      key: 'createdAt',
      header: 'Tanggal',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    {
      key: 'type',
      header: 'Jenis',
      width: pixel(160),
      renderCell: (i) => {
        const labels: Record<string, string> = {
          setor_pokok: 'Setor Simpanan Pokok',
          setor_wajib: 'Setor Simpanan Wajib',
          setor_sukarela: 'Setor Simpanan Sukarela',
          tarik_sukarela: 'Tarik Simpanan Sukarela',
          bunga: 'Jasa Simpanan',
        };
        return labels[i.type] ?? i.type?.replace(/_/g, ' ');
      },
    },
    {
      key: 'amount',
      header: 'Jumlah',
      width: pixel(150),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Akhir',
      width: proportional(1),
      renderCell: (i) => formatRp(i.balanceAfter),
    },
  ];

  const loanCols: TableColumn<PortalLoan>[] = [
    {
      key: 'createdAt',
      header: 'Tgl Pengajuan',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    { key: 'purpose', header: 'Keperluan', width: proportional(1) },
    {
      key: 'amount',
      header: 'Pokok',
      width: pixel(120),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(100),
      renderCell: (i) => {
        const statusMap: Record<string, { variant: 'success' | 'warning' | 'critical' | 'neutral'; label: string }> = {
          Disetujui: { variant: 'success', label: 'Disetujui' },
          Lunas: { variant: 'success', label: 'Lunas' },
          Menunggu: { variant: 'warning', label: 'Menunggu' },
          Ditolak: { variant: 'critical', label: 'Ditolak' },
          Macet: { variant: 'critical', label: 'Macet' },
        };
        const s = statusMap[i.status] || { variant: 'neutral', label: i.status };
        return <Badge variant={s.variant} label={s.label} />;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(120),
      renderCell: (i) => (
        <Button
          label={selectedLoan?.id === i.id ? 'Tutup' : 'Jadwal'}
          size="sm"
          variant={selectedLoan?.id === i.id ? 'secondary' : 'primary'}
          onClick={() => {
            if (selectedLoan?.id === i.id) {
              setSelectedLoan(null);
              setSchedule([]);
            } else {
              loadSchedule(i);
            }
          }}
        />
      ),
    },
  ];

  return (
    <Layout>
      <LayoutContent padding={4}>
        <VStack gap={6}>
          {isPreview && (
            <Card
              style={{
                padding: 16,
                backgroundColor: 'var(--color-background-secondary)',
                border: '1px solid var(--color-warning-500, #f59e0b)',
              }}
            >
              <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                <VStack gap={1}>
                  <Text type="body" weight="bold">
                    Mode pratinjau admin
                  </Text>
                  <Text type="supporting" color="secondary">
                    Anda melihat portal sebagai {previewName || profile?.name || 'anggota'}.
                    Perubahan tidak disimpan ke sesi anggota. Token pratinjau berlaku ~15 menit.
                  </Text>
                </VStack>
                <Button label="Kembali ke Admin" variant="primary" onClick={exitPreview} />
              </HStack>
            </Card>
          )}

          <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
            <Heading level={2}>Selamat Datang, {profile?.name}</Heading>
            <HStack gap={2} vAlign="center">
              <IconButton
                label={isDark ? "Mode Terang" : "Mode Gelap"}
                icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
                variant="ghost"
                onClick={() => setMode(isDark ? 'light' : 'dark')}
              />
              <Button
                label={isPreview ? 'Tutup pratinjau' : 'Keluar'}
                onClick={handleLogout}
                variant="ghost"
              />
            </HStack>
          </HStack>

          {error ? (
            <Text type="supporting" color="critical">
              {error}
            </Text>
          ) : null}

          <Grid gap={4}>
            <Card>
              <VStack gap={2}>
                <Text type="supporting">Total Simpanan</Text>
                <Heading level={2} color="primary">
                  {formatRp(profile?.totalSavings || 0)}
                </Heading>
              </VStack>
            </Card>
            <Card>
              <VStack gap={2}>
                <Text type="supporting">Pokok</Text>
                <Heading level={3}>{formatRp(profile?.simpananPokok || 0)}</Heading>
              </VStack>
            </Card>
            <Card>
              <VStack gap={2}>
                <Text type="supporting">Wajib</Text>
                <Heading level={3}>{formatRp(profile?.simpananWajib || 0)}</Heading>
              </VStack>
            </Card>
            <Card>
              <VStack gap={2}>
                <Text type="supporting">Sukarela</Text>
                <Heading level={3}>{formatRp(profile?.simpananSukarela || 0)}</Heading>
              </VStack>
            </Card>
          </Grid>

          <HStack gap={4}>
            <Button
              label="Simpanan"
              variant={activeTab === 'savings' ? 'primary' : 'ghost'}
              onClick={() => {
                setActiveTab('savings');
                setSelectedLoan(null);
              }}
            />
            <Button
              label="Pinjaman"
              variant={activeTab === 'loans' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('loans')}
            />
            <Button
              label="Laporan Keuangan"
              variant={activeTab === 'reports' ? 'primary' : 'ghost'}
              onClick={() => {
                setActiveTab('reports');
                if (!incomeData || !balanceData) {
                  loadReports();
                }
              }}
            />
          </HStack>

          <Card>
            <VStack gap={4}>
              <HStack justify="space-between" vAlign="center">
                <Heading level={4}>
                  {activeTab === 'savings'
                    ? 'Riwayat Simpanan'
                    : activeTab === 'loans'
                    ? 'Daftar Pinjaman'
                    : 'Ringkasan Laporan Keuangan Koperasi'}
                </Heading>
                {activeTab === 'loans' && (
                  <Button
                    label={showApplyForm ? 'Tutup Formulir' : '+ Ajukan Pinjaman Baru'}
                    variant={showApplyForm ? 'ghost' : 'primary'}
                    onClick={() => {
                      setShowApplyForm(!showApplyForm);
                      setApplyError('');
                      setApplySuccess('');
                    }}
                  />
                )}
              </HStack>

              {activeTab === 'loans' && showApplyForm && (
                <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                  <form onSubmit={handleApplyLoan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Heading level={4}>Formulir Pengajuan Pinjaman Baru</Heading>

                    {applyError ? (
                      <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                        ⚠️ {applyError}
                      </Text>
                    ) : null}

                    {applySuccess ? (
                      <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                        ✅ {applySuccess}
                      </Text>
                    ) : null}

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting">Nominal Pinjaman (Rp)</Text>
                        <input
                          type="number"
                          min="100000"
                          step="100000"
                          placeholder="Contoh: 5000000"
                          value={applyAmount}
                          onChange={(e) => setApplyAmount(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting">Tenor (Bulan)</Text>
                        <select
                          value={applyTenor}
                          onChange={(e) => setApplyTenor(e.target.value)}
                          style={inputStyle}
                          required
                        >
                          <option value="3">3 Bulan</option>
                          <option value="6">6 Bulan</option>
                          <option value="12">12 Bulan (1 Tahun)</option>
                          <option value="18">18 Bulan</option>
                          <option value="24">24 Bulan (2 Tahun)</option>
                          <option value="36">36 Bulan (3 Tahun)</option>
                        </select>
                      </VStack>
                    </Grid>

                    <VStack gap={2}>
                      <Text type="supporting">Keperluan / Tujuan Pinjaman</Text>
                      <textarea
                        rows={3}
                        placeholder="Jelaskan keperluan pengajuan pinjaman (contoh: Biaya pendidikan, Renovasi rumah, Modal usaha)"
                        value={applyPurpose}
                        onChange={(e) => setApplyPurpose(e.target.value)}
                        style={inputStyle}
                        required
                      />
                    </VStack>

                    {/* Estimasi Simulasi */}
                    {parseFloat(applyAmount) > 0 && (
                      <Card style={{ padding: 12, backgroundColor: 'var(--color-background-primary)' }}>
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">Estimasi Angsuran Per Bulan (Bunga 1,5%/th Anuitas)</Text>
                          <Text type="body" weight="bold" color="primary">
                            {(() => {
                              const P = parseFloat(applyAmount) || 0;
                              const n = parseInt(applyTenor, 10) || 12;
                              const r = 0.015 / 12;
                              const pmt = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
                              return formatRp(pmt);
                            })()} / bulan
                          </Text>
                        </VStack>
                      </Card>
                    )}

                    <HStack gap={3} justify="end">
                      <Button
                        label="Batal"
                        variant="ghost"
                        type="button"
                        onClick={() => setShowApplyForm(false)}
                        isDisabled={applyLoading}
                      />
                      <Button
                        label={applyLoading ? 'Mengirim...' : 'Kirim Pengajuan'}
                        variant="primary"
                        type="submit"
                        isDisabled={applyLoading}
                      />
                    </HStack>
                  </form>
                </Card>
              )}

              {activeTab === 'savings' ? (
                transactions.length > 0 ? (
                  <Table data={transactions} columns={txCols} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting">Belum ada transaksi</Text>
                )
              ) : activeTab === 'reports' ? (
                reportsLoading ? (
                  <Spinner size="md" />
                ) : (
                  <VStack gap={6}>
                    {/* Laporan Laba Rugi */}
                    <VStack gap={3}>
                      <Heading level={4}>1. Laporan Laba Rugi (Income Statement)</Heading>
                      <Grid gap={4}>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Pendapatan</Text>
                            <Heading level={3} color="primary">{formatRp(incomeData?.totalRevenue || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Beban Operasional</Text>
                            <Heading level={3}>{formatRp(incomeData?.totalExpense || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">SHU / Laba Bersih Tahun Berjalan</Text>
                            <Heading level={3} color="primary">{formatRp(incomeData?.netIncome || 0)}</Heading>
                          </VStack>
                        </Card>
                      </Grid>
                    </VStack>

                    {/* Laporan Neraca */}
                    <VStack gap={3}>
                      <Heading level={4}>2. Laporan Neraca Koperasi (Balance Sheet)</Heading>
                      <Grid gap={4}>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Aset Koperasi</Text>
                            <Heading level={3} color="primary">{formatRp(balanceData?.totalAssets || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Kewajiban / Liabilitas</Text>
                            <Heading level={3}>{formatRp(balanceData?.totalLiabilities || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Ekuitas / Modal</Text>
                            <Heading level={3}>{formatRp(balanceData?.totalEquity || 0)}</Heading>
                          </VStack>
                        </Card>
                      </Grid>

                      {/* Ringkasan Neraca */}
                      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                        <VStack gap={2}>
                          <Text type="body" weight="bold">Keseimbangan Neraca (Aset = Kewajiban + Ekuitas)</Text>
                          <HStack justify="space-between" wrap="wrap" gap={2}>
                            <Text type="supporting">Total Aset: {formatRp(balanceData?.totalAssets || 0)}</Text>
                            <Text type="body" weight="semibold">
                              Total Pasiva: {formatRp((balanceData?.totalLiabilities || 0) + (balanceData?.totalEquity || 0))}
                            </Text>
                          </HStack>
                        </VStack>
                      </Card>
                    </VStack>
                  </VStack>
                )
              ) : loans.length > 0 ? (
                <VStack gap={4}>
                  <Table data={loans} columns={loanCols} idKey="id" density="balanced" />

                  {selectedLoan && (
                    <VStack gap={3}>
                      <Heading level={4}>
                        Jadwal Angsuran — {selectedLoan.purpose || 'Pinjaman'}
                      </Heading>
                      <HStack gap={4} wrap="wrap">
                        <Text type="supporting">
                          Pokok: <Text type="body" weight="semibold">{formatRp(selectedLoan.amount)}</Text>
                        </Text>
                        <Text type="supporting">
                          Total tagihan:{' '}
                          <Text type="body" weight="semibold">
                            {formatRp(selectedLoan.totalAmount || selectedLoan.amount)}
                          </Text>
                        </Text>
                        {selectedLoan.monthlyPayment != null && (
                          <Text type="supporting">
                            Angsuran/bulan:{' '}
                            <Text type="body" weight="semibold">
                              {formatRp(selectedLoan.monthlyPayment)}
                            </Text>
                          </Text>
                        )}
                        <Text type="supporting">
                          Sisa dari jadwal:{' '}
                          <Text type="body" weight="semibold">
                            {formatRp(remainingOnSchedule)}
                          </Text>
                        </Text>
                      </HStack>

                      {scheduleLoading ? (
                        <Spinner size="md" />
                      ) : schedule.length > 0 ? (
                        <Table data={schedule} columns={scheduleCols} idKey="id" density="balanced" />
                      ) : (
                        <Text type="supporting">
                          Jadwal angsuran belum tersedia (pinjaman mungkin belum disetujui).
                        </Text>
                      )}
                    </VStack>
                  )}
                </VStack>
              ) : (
                <Text type="supporting">Belum ada pinjaman</Text>
              )}
            </VStack>
          </Card>
        </VStack>
      </LayoutContent>
    </Layout>
  );
}

const Grid = ({ children, gap = 4 }: { children: React.ReactNode; gap?: number }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: `var(--spacing-${gap}, ${gap * 4}px)`,
    }}
  >
    {children}
  </div>
);
