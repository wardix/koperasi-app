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
  const [activeTab, setActiveTab] = useState<'savings' | 'loans'>('savings');
  const [selectedLoan, setSelectedLoan] = useState<PortalLoan | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

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
            i.status === 'Paid' ? 'success' : i.status === 'Late' ? 'error' : 'neutral';
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
        <Card style={{ width: '100%', maxWidth: 400, padding: 32 }}>
          <VStack gap={6}>
            <Heading level={2} align="center">
              Portal Anggota
            </Heading>
            <Text type="body" color="secondary" align="center">
              Masuk untuk melihat simpanan, pinjaman, dan jadwal angsuran Anda.
            </Text>
            {error ? (
              <Text type="supporting" color="accent">
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
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6 }}
                  required
                />
              </VStack>
              <VStack gap={2}>
                <Text type="supporting">Kata Sandi</Text>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6 }}
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
                  color: 'var(--color-text-primary, #0171E3)',
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
    { key: 'type', header: 'Jenis', width: pixel(100) },
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
      renderCell: (i) => (
        <Badge
          variant={i.status === 'Disetujui' ? 'success' : i.status === 'Lunas' ? 'success' : 'neutral'}
          label={i.status}
        />
      ),
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
                backgroundColor: 'var(--color-background-secondary, #fef3c7)',
                border: '1px solid var(--color-border-primary, #f59e0b)',
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

          <HStack justify="space-between" vAlign="center" wrap="wrap">
            <Heading level={2}>Selamat Datang, {profile?.name}</Heading>
            <Button
              label={isPreview ? 'Tutup pratinjau' : 'Keluar'}
              onClick={handleLogout}
              variant="ghost"
            />
          </HStack>

          {error ? (
            <Text type="supporting" color="accent">
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
          </HStack>

          <Card>
            <VStack gap={4}>
              <Heading level={4}>
                {activeTab === 'savings' ? 'Riwayat Simpanan' : 'Daftar Pinjaman'}
              </Heading>
              {activeTab === 'savings' ? (
                transactions.length > 0 ? (
                  <Table data={transactions} columns={txCols} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting">Belum ada transaksi</Text>
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

const Grid = ({ children, gap }: { children: React.ReactNode; gap: number }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: `${gap * 4}px`,
    }}
  >
    {children}
  </div>
);
