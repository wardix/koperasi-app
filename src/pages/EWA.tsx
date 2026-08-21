import React, { useState, useEffect, useMemo } from 'react';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import {
  BanknotesIcon,
  UserGroupIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { Icon } from '@astryxdesign/core/Icon';
import type { CompanyEmployee, EWARequest } from '../../shared/types';

export default function EWA() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'employees' | 'payroll'>('requests');

  // Requests State
  const [requests, setRequests] = useState<EWARequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReq, setSelectedReq] = useState<EWARequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Employees State
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Payroll Recap State
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollRecap, setPayrollRecap] = useState<any>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);

  // Fetch Requests
  const fetchRequests = async () => {
    setReqLoading(true);
    try {
      const url = new URL('/api/v1/ewa/requests', window.location.origin);
      if (statusFilter) url.searchParams.set('status', statusFilter);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then((r) => r.json());
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setReqLoading(false);
    }
  };

  // Fetch Employees
  const fetchEmployees = async () => {
    setEmpLoading(true);
    try {
      const url = new URL('/api/v1/ewa/employees', window.location.origin);
      if (empSearch) url.searchParams.set('search', empSearch);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then((r) => r.json());
      if (res.success) {
        setEmployees(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setEmpLoading(false);
    }
  };

  // Fetch Payroll Recap
  const fetchPayrollRecap = async () => {
    setPayrollLoading(true);
    try {
      const url = new URL('/api/v1/ewa/payroll/recap', window.location.origin);
      url.searchParams.set('periodMonth', payrollMonth);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then((r) => r.json());
      if (res.success) {
        setPayrollRecap(res.data);
      }
    } catch {
      // ignore
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'payroll') fetchPayrollRecap();
  }, [activeTab, statusFilter, payrollMonth]);

  // Handle Disburse
  const handleDisburse = async (req: EWARequest) => {
    if (!confirm(`Konfirmasi pencairan dana EWA sebesar ${formatRp(req.disbursedAmount)} ke ${req.destinationBank} (${req.destinationAccount}) atas nama ${req.destinationName}?`)) {
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/ewa/requests/${req.id}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({}),
      }).then((r) => r.json());

      if (res.success) {
        setActionMessage({ text: res.message || 'Dana berhasil dicairkan!', type: 'success' });
        fetchRequests();
      } else {
        setActionMessage({ text: res.message || 'Gagal mencairkan EWA', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/ewa/requests/${selectedReq.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason: rejectReason }),
      }).then((r) => r.json());

      if (res.success) {
        setActionMessage({ text: 'Permohonan EWA telah ditolak', type: 'success' });
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedReq(null);
        fetchRequests();
      } else {
        setActionMessage({ text: res.message || 'Gagal menolak EWA', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Settle Payroll
  const handleSettlePayroll = async () => {
    if (!payrollRecap || payrollRecap.totalEmployees === 0) return;
    if (!confirm(`Konfirmasi pembukuan pelunasan payroll periode ${payrollMonth} sebesar ${formatRp(payrollRecap.totalDeduction)}? Seluruh tagihan piutang EWA periode ini akan ditutup lunas.`)) {
      return;
    }
    setSettleLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/v1/ewa/payroll/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ periodMonth: payrollMonth }),
      }).then((r) => r.json());

      if (res.success) {
        setActionMessage({ text: res.message || 'Pelunasan payroll berhasil dibukukan!', type: 'success' });
        fetchPayrollRecap();
      } else {
        setActionMessage({ text: res.message || 'Gagal memproses pelunasan payroll', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setSettleLoading(false);
    }
  };

  // Export Payroll CSV for HRD
  const exportPayrollCsv = () => {
    if (!payrollRecap?.items || payrollRecap.items.length === 0) return;
    const headers = ['NIP', 'Nama Karyawan', 'Departemen', 'Status Koperasi', 'Total Kasbon EWA', 'Biaya Layanan (Fee)', 'Total Potongan Gaji'];
    const rows = payrollRecap.items.map((it: any) => [
      `"${it.nip}"`,
      `"${it.name}"`,
      `"${it.department || '-'}"`,
      `"${it.isMember ? 'Anggota' : 'Bukan Anggota'}"`,
      it.totalAdvances,
      it.totalFee,
      it.totalDeduction,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Potongan_Payroll_EWA_${payrollMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV Import
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const lines = importCsvText.trim().split('\n');
      if (lines.length < 2) {
        setImportError('Data CSV kosong atau tidak memiliki baris data');
        setImportLoading(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const items: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = vals[idx] || '';
        });

        items.push({
          nip: obj.nip || obj['no_karyawan'] || '',
          nik: obj.nik || null,
          name: obj.nama || obj.name || '',
          email: obj.email || '',
          phone: obj.telepon || obj.phone || null,
          department: obj.departemen || obj.department || null,
          position: obj.jabatan || obj.position || null,
          baseSalary: parseFloat(obj.gaji_pokok || obj.gaji || obj.basesalary || '0') || 0,
          bankName: obj.bank || obj.nama_bank || null,
          bankAccountNumber: obj.rekening || obj.no_rekening || null,
          bankAccountName: obj.nama_rekening || obj.atas_nama || null,
        });
      }

      const res = await fetch('/api/v1/ewa/employees/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ items }),
      }).then((r) => r.json());

      if (res.success) {
        setImportSuccess(`Berhasil memproses ${res.data.processedCount} karyawan!`);
        setTimeout(() => {
          setShowImportModal(false);
          setImportCsvText('');
          setImportSuccess('');
          fetchEmployees();
        }, 1500);
      } else {
        setImportError(res.message || 'Gagal mengimpor data karyawan');
      }
    } catch {
      setImportError('Format CSV tidak valid atau terjadi kegagalan jaringan');
    } finally {
      setImportLoading(false);
    }
  };

  // Table Columns - Requests
  const requestColumns: TableColumn<EWARequest>[] = useMemo(
    () => [
      {
        id: 'date',
        header: 'Tanggal',
        width: pixel(110),
        cell: (r) => (
          <Text type="supporting">
            {new Date(r.createdAt).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        ),
      },
      {
        id: 'employee',
        header: 'Karyawan',
        width: proportional(1.5),
        cell: (r) => (
          <VStack gap={0}>
            <Text type="body" weight="medium">
              {r.employeeName}
            </Text>
            <HStack gap={1} vAlign="center">
              <Text type="supporting" color="secondary">
                NIP: {r.employeeNip || '-'}
              </Text>
              <Badge variant={r.isMember ? 'success' : 'neutral'} size="sm">
                {r.isMember ? 'Anggota' : 'Non-Anggota'}
              </Badge>
            </HStack>
          </VStack>
        ),
      },
      {
        id: 'amount',
        header: 'Nominal Tarik',
        width: proportional(1.2),
        cell: (r) => (
          <VStack gap={0}>
            <Text type="body" weight="semibold" color="primary">
              {formatRp(r.disbursedAmount)}
            </Text>
            <Text type="supporting" color="secondary">
              Fee: {formatRp(r.feeAmount)} ({r.feePercentage}%)
            </Text>
          </VStack>
        ),
      },
      {
        id: 'deduction',
        header: 'Potong Payroll',
        width: proportional(1.2),
        cell: (r) => (
          <Text type="body" weight="bold">
            {formatRp(r.totalPayrollDeduction)}
          </Text>
        ),
      },
      {
        id: 'bank',
        header: 'Rekening Tujuan',
        width: proportional(1.5),
        cell: (r) => (
          <VStack gap={0}>
            <Text type="body">
              {r.destinationBank} — {r.destinationAccount}
            </Text>
            <Text type="supporting" color="secondary">
              a.n. {r.destinationName}
            </Text>
          </VStack>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: pixel(130),
        cell: (r) => {
          let variant: any = 'neutral';
          let label = r.status;
          if (r.status === 'PENDING') {
            variant = 'warning';
            label = 'Menunggu Cair';
          } else if (r.status === 'DISBURSED') {
            variant = 'info';
            label = 'Sudah Cair';
          } else if (r.status === 'PAID_SETTLED') {
            variant = 'success';
            label = 'Lunas Payroll';
          } else if (r.status === 'REJECTED') {
            variant = 'critical';
            label = 'Ditolak';
          }
          return <Badge variant={variant}>{label}</Badge>;
        },
      },
      {
        id: 'action',
        header: 'Aksi',
        width: pixel(180),
        cell: (r) =>
          r.status === 'PENDING' && (
            <HStack gap={2}>
              <Button
                label="Cairkan"
                variant="primary"
                size="sm"
                isDisabled={actionLoading}
                onClick={() => handleDisburse(r)}
              />
              <Button
                label="Tolak"
                variant="ghost"
                size="sm"
                isDisabled={actionLoading}
                onClick={() => {
                  setSelectedReq(r);
                  setShowRejectModal(true);
                }}
              />
            </HStack>
          ),
      },
    ],
    [actionLoading]
  );

  // Table Columns - Employees
  const employeeColumns: TableColumn<CompanyEmployee>[] = useMemo(
    () => [
      {
        id: 'nip',
        header: 'NIP / NIK',
        width: pixel(140),
        cell: (e) => (
          <VStack gap={0}>
            <Text type="body" weight="medium">{e.nip}</Text>
            <Text type="supporting" color="secondary">{e.nik || '-'}</Text>
          </VStack>
        ),
      },
      {
        id: 'name',
        header: 'Nama & Email',
        width: proportional(1.5),
        cell: (e) => (
          <VStack gap={0}>
            <Text type="body" weight="semibold">{e.name}</Text>
            <Text type="supporting" color="secondary">{e.email}</Text>
          </VStack>
        ),
      },
      {
        id: 'dept',
        header: 'Departemen / Posisi',
        width: proportional(1.2),
        cell: (e) => (
          <VStack gap={0}>
            <Text type="body">{e.department || '-'}</Text>
            <Text type="supporting" color="secondary">{e.position || '-'}</Text>
          </VStack>
        ),
      },
      {
        id: 'salary',
        header: 'Gaji Pokok',
        width: proportional(1.2),
        cell: (e) => (
          <VStack gap={0}>
            <Text type="body" weight="semibold">{formatRp(e.baseSalary)}</Text>
            <Text type="supporting" color="secondary">Plafon 50%: {formatRp(e.baseSalary * 0.5)}</Text>
          </VStack>
        ),
      },
      {
        id: 'status',
        header: 'Status Koperasi',
        width: pixel(140),
        cell: (e) => (
          <Badge variant={e.isMember ? 'success' : 'neutral'}>
            {e.isMember ? 'Anggota Koperasi' : 'Bukan Anggota'}
          </Badge>
        ),
      },
      {
        id: 'bank',
        header: 'Rekening Payroll',
        width: proportional(1.5),
        cell: (e) => (
          <Text type="supporting">
            {e.bankName ? `${e.bankName} - ${e.bankAccountNumber}` : 'Belum diatur'}
          </Text>
        ),
      },
    ],
    []
  );

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <div style={{ padding: '16px 24px', width: '100%', boxSizing: 'border-box' }}>
            <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3} style={{ width: '100%' }}>
              <VStack gap={1}>
                <Heading level={2} style={{ margin: 0 }}>
                  Layanan Gaji Awal (EWA)
                </Heading>
                <Text type="supporting" color="secondary">
                  Earned Wage Access — Fasilitas kasbon gaji karyawan perusahaan induk
                </Text>
              </VStack>

              <HStack gap={2}>
                <Button
                  label="Muat Ulang"
                  variant="secondary"
                  icon={<Icon icon={ArrowPathIcon} size="sm" />}
                  onClick={() => {
                    if (activeTab === 'requests') fetchRequests();
                    if (activeTab === 'employees') fetchEmployees();
                    if (activeTab === 'payroll') fetchPayrollRecap();
                  }}
                />
                {activeTab === 'employees' && (
                  <Button
                    label="Import Data Karyawan (CSV)"
                    variant="primary"
                    icon={<Icon icon={ArrowUpTrayIcon} size="sm" />}
                    onClick={() => setShowImportModal(true)}
                  />
                )}
                {activeTab === 'payroll' && payrollRecap?.items?.length > 0 && (
                  <Button
                    label="Ekspor CSV untuk HRD"
                    variant="primary"
                    icon={<Icon icon={DocumentArrowDownIcon} size="sm" />}
                    onClick={exportPayrollCsv}
                  />
                )}
              </HStack>
            </HStack>
          </div>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        <VStack gap={6}>
          {actionMessage && (
            <Card
              style={{
                padding: 12,
                backgroundColor:
                  actionMessage.type === 'success'
                    ? 'var(--color-background-success-subtle, rgba(34, 197, 94, 0.1))'
                    : 'var(--color-background-critical-subtle, rgba(239, 68, 68, 0.1))',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--color-success-500, #22c55e)' : 'var(--color-critical-500, #ef4444)'}`,
              }}
            >
              <Text type="body" weight="semibold">
                {actionMessage.type === 'success' ? '✅ ' : '⚠️ '}
                {actionMessage.text}
              </Text>
            </Card>
          )}

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              backgroundColor: 'var(--color-background-secondary)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border-primary)',
              gap: 4,
              width: 'fit-content',
            }}
          >
            {[
              { id: 'requests' as const, label: 'Pengajuan & Pencairan', icon: BanknotesIcon },
              { id: 'employees' as const, label: 'Master Karyawan & Gaji', icon: UserGroupIcon },
              { id: 'payroll' as const, label: 'Rekap Potongan Payroll (HRD)', icon: DocumentArrowDownIcon },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--color-background-primary)' : 'transparent',
                    color: isActive ? 'var(--color-primary-500, var(--color-text-primary))' : 'var(--color-text-secondary)',
                    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  <tab.icon style={{ width: 18, height: 18, color: 'currentColor' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: REQUESTS */}
          {activeTab === 'requests' && (
            <Card>
              <VStack gap={4}>
                <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                  <Heading level={4}>Daftar Pengajuan Penarikan Gaji Awal</Heading>
                  <HStack gap={2} vAlign="center">
                    <Text type="supporting">Status:</Text>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border-primary)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <option value="">Semua Status</option>
                      <option value="PENDING">Menunggu Cair</option>
                      <option value="DISBURSED">Sudah Cair</option>
                      <option value="PAID_SETTLED">Lunas Payroll</option>
                      <option value="REJECTED">Ditolak</option>
                    </select>
                  </HStack>
                </HStack>

                {reqLoading ? (
                  <Spinner size="md" />
                ) : requests.length > 0 ? (
                  <Table data={requests} columns={requestColumns} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting" color="secondary">
                    Belum ada data pengajuan EWA
                  </Text>
                )}
              </VStack>
            </Card>
          )}

          {/* TAB 2: EMPLOYEES */}
          {activeTab === 'employees' && (
            <Card>
              <VStack gap={4}>
                <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                  <Heading level={4}>Master Data Karyawan Perusahaan Induk</Heading>
                  <input
                    type="text"
                    placeholder="Cari nama / NIP / email..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchEmployees()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      width: 250,
                    }}
                  />
                </HStack>

                {empLoading ? (
                  <Spinner size="md" />
                ) : employees.length > 0 ? (
                  <Table data={employees} columns={employeeColumns} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting" color="secondary">
                    Belum ada data karyawan. Gunakan tombol "Import Data Karyawan (CSV)" untuk menambahkan.
                  </Text>
                )}
              </VStack>
            </Card>
          )}

          {/* TAB 3: PAYROLL RECAP */}
          {activeTab === 'payroll' && (
            <VStack gap={4}>
              <Card>
                <VStack gap={4}>
                  <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                    <VStack gap={1}>
                      <Heading level={4}>Rekap Tagihan Potongan Gaji ke HRD</Heading>
                      <Text type="supporting" color="secondary">
                        Rekapitulasi total dana kasbon & fee yang wajib dipotong dari slip gaji karyawan periode ini
                      </Text>
                    </VStack>

                    <HStack gap={3} vAlign="center">
                      <Text type="supporting">Pilih Periode:</Text>
                      <input
                        type="month"
                        value={payrollMonth}
                        onChange={(e) => setPayrollMonth(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border-primary)',
                          backgroundColor: 'var(--color-background-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </HStack>
                  </HStack>

                  {/* Summary Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 16,
                    }}
                  >
                    <Card style={{ padding: 16 }}>
                      <VStack gap={1}>
                        <Text type="supporting">Total Karyawan Menggunakan EWA</Text>
                        <Heading level={3}>{payrollRecap?.totalEmployees || 0} Orang</Heading>
                      </VStack>
                    </Card>
                    <Card style={{ padding: 16 }}>
                      <VStack gap={1}>
                        <Text type="supporting">Total Pokok Kasbon EWA</Text>
                        <Heading level={3}>{formatRp(payrollRecap?.totalDisbursed || 0)}</Heading>
                      </VStack>
                    </Card>
                    <Card style={{ padding: 16 }}>
                      <VStack gap={1}>
                        <Text type="supporting">Total Fee Administrasi EWA</Text>
                        <Heading level={3} color="primary">{formatRp(payrollRecap?.totalFee || 0)}</Heading>
                      </VStack>
                    </Card>
                    <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)' }}>
                      <VStack gap={1}>
                        <Text type="supporting">Total Tagihan Potong Payroll</Text>
                        <Heading level={3} color="primary">{formatRp(payrollRecap?.totalDeduction || 0)}</Heading>
                      </VStack>
                    </Card>
                  </div>

                  {payrollLoading ? (
                    <Spinner size="md" />
                  ) : payrollRecap?.items?.length > 0 ? (
                    <VStack gap={4}>
                      <div style={{ overflowX: 'auto' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '14px',
                            textAlign: 'left',
                          }}
                        >
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border-primary)' }}>
                              <th style={{ padding: '10px 12px' }}>NIP</th>
                              <th style={{ padding: '10px 12px' }}>Nama Karyawan</th>
                              <th style={{ padding: '10px 12px' }}>Departemen</th>
                              <th style={{ padding: '10px 12px' }}>Status Anggota</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Kasbon EWA</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Fee Layanan</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Potong Gaji</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrollRecap.items.map((it: any) => (
                              <tr key={it.employeeId} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '10px 12px' }}>{it.nip}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.name}</td>
                                <td style={{ padding: '10px 12px' }}>{it.department || '-'}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <Badge variant={it.isMember ? 'success' : 'neutral'} size="sm">
                                    {it.isMember ? 'Anggota' : 'Non-Anggota'}
                                  </Badge>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatRp(it.totalAdvances)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatRp(it.totalFee)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                                  {formatRp(it.totalDeduction)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <HStack justify="end" gap={3}>
                        {payrollRecap.isFullySettled ? (
                          <Badge variant="success" size="lg">
                            ✅ Periode Ini Sudah Lunas Payroll
                          </Badge>
                        ) : (
                          <Button
                            label={settleLoading ? 'Memproses...' : 'Bukukan Pelunasan Payroll Dari Perusahaan'}
                            variant="primary"
                            isDisabled={settleLoading}
                            onClick={handleSettlePayroll}
                          />
                        )}
                      </HStack>
                    </VStack>
                  ) : (
                    <Text type="supporting" color="secondary">
                      Tidak ada tagihan penarikan EWA untuk periode {payrollMonth}.
                    </Text>
                  )}
                </VStack>
              </Card>
            </VStack>
          )}

          {/* Modal Reject */}
          {showRejectModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <Card style={{ width: 450, padding: 24, maxWidth: '90%' }}>
                <form onSubmit={handleReject}>
                  <VStack gap={4}>
                    <Heading level={4}>Tolak Permohonan EWA</Heading>
                    <Text type="supporting">
                      Karyawan: <b>{selectedReq?.employeeName}</b> (Nominal: {formatRp(selectedReq?.disbursedAmount || 0)})
                    </Text>
                    <VStack gap={2}>
                      <Text type="supporting">Alasan Penolakan:</Text>
                      <textarea
                        rows={3}
                        required
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Contoh: Melebihi batas hari kerja / dalam masa pengunduran diri"
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid var(--color-border-primary)',
                          backgroundColor: 'var(--color-background-primary)',
                          color: 'var(--color-text-primary)',
                          boxSizing: 'border-box',
                        }}
                      />
                    </VStack>
                    <HStack justify="end" gap={2}>
                      <Button
                        label="Batal"
                        variant="ghost"
                        type="button"
                        onClick={() => setShowRejectModal(false)}
                      />
                      <Button
                        label={actionLoading ? 'Menolak...' : 'Konfirmasi Tolak'}
                        variant="critical"
                        type="submit"
                        isDisabled={actionLoading}
                      />
                    </HStack>
                  </VStack>
                </form>
              </Card>
            </div>
          )}

          {/* Modal Import CSV */}
          {showImportModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <Card style={{ width: 550, padding: 24, maxWidth: '90%' }}>
                <form onSubmit={handleImportCsv}>
                  <VStack gap={4}>
                    <Heading level={4}>Import Data Karyawan (CSV)</Heading>
                    <Text type="supporting" color="secondary">
                      Format header: <code>nip,nik,nama,email,departemen,jabatan,gaji_pokok,bank,rekening,nama_rekening</code>
                    </Text>

                    {importError && (
                      <Text type="supporting" color="critical">
                        ⚠️ {importError}
                      </Text>
                    )}
                    {importSuccess && (
                      <Text type="supporting" color="success">
                        ✅ {importSuccess}
                      </Text>
                    )}

                    <textarea
                      rows={8}
                      required
                      placeholder={`nip,nik,nama,email,departemen,jabatan,gaji_pokok,bank,rekening,nama_rekening\nEMP001,3201010001,Budi Santoso,budi@holding.com,IT,Staff,8000000,Bank Mandiri,1400012345,Budi Santoso`}
                      value={importCsvText}
                      onChange={(e) => setImportCsvText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 10,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid var(--color-border-primary)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />

                    <HStack justify="end" gap={2}>
                      <Button
                        label="Batal"
                        variant="ghost"
                        type="button"
                        onClick={() => setShowImportModal(false)}
                      />
                      <Button
                        label={importLoading ? 'Mengimpor...' : 'Proses Import'}
                        variant="primary"
                        type="submit"
                        isDisabled={importLoading}
                      />
                    </HStack>
                  </VStack>
                </form>
              </Card>
            </div>
          )}
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
