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
import { apiFetch } from '../config';
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
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiFetch(`/api/v1/ewa/requests${q}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setReqLoading(false);
    }
  };

  // Fetch Employees
  const fetchEmployees = async () => {
    setEmpLoading(true);
    try {
      const q = empSearch ? `?search=${encodeURIComponent(empSearch)}` : '';
      const res = await apiFetch(`/api/v1/ewa/employees${q}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
    } finally {
      setEmpLoading(false);
    }
  };

  // Fetch Payroll Recap
  const fetchPayrollRecap = async () => {
    setPayrollLoading(true);
    try {
      const res = await apiFetch(`/api/v1/ewa/payroll/recap?periodMonth=${encodeURIComponent(payrollMonth)}`);
      const data = await res.json();
      if (data.success) {
        setPayrollRecap(data.data);
      }
    } catch (err) {
      console.error('Fetch payroll recap error:', err);
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchEmployees();
    fetchPayrollRecap();
  }, []);

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
      const res = await apiFetch(`/api/v1/ewa/requests/${req.id}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage({ text: data.message || 'Dana berhasil dicairkan!', type: 'success' });
        fetchRequests();
      } else {
        setActionMessage({ text: data.message || 'Gagal mencairkan EWA', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Terjadi kesalahan jaringan', type: 'error' });
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
      const res = await apiFetch(`/api/v1/ewa/requests/${selectedReq.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage({ text: 'Permohonan EWA telah ditolak', type: 'success' });
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedReq(null);
        fetchRequests();
      } else {
        setActionMessage({ text: data.message || 'Gagal menolak EWA', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Terjadi kesalahan jaringan', type: 'error' });
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
      const res = await apiFetch('/api/v1/ewa/payroll/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth: payrollMonth }),
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage({ text: data.message || 'Pelunasan payroll berhasil dibukukan!', type: 'success' });
        fetchPayrollRecap();
      } else {
        setActionMessage({ text: data.message || 'Gagal memproses pelunasan payroll', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err?.message || 'Terjadi kesalahan jaringan', type: 'error' });
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
  function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // Handle CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) setImportCsvText(text);
    };
    reader.readAsText(file);
  };

  // Handle CSV Import
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const cleanText = importCsvText.replace(/^\uFEFF/, '').trim();
      const lines = cleanText.split(/\r?\n/);
      if (lines.length < 2) {
        setImportError('Data CSV kosong atau tidak memiliki baris data');
        setImportLoading(false);
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) =>
        h.trim().toLowerCase().replace(/^"|"$/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
      );
      const items: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = parseCSVLine(line);
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h] = (vals[idx] || '').trim().replace(/^"|"$/g, '');
        });

        const rawSalaryStr =
          obj['jumlah gaji'] || obj['gaji_pokok'] || obj['gaji'] || obj['basesalary'] || obj['salary'] || '0';
        const rawLoanStr =
          obj['jumlah potongan pinjaman (jika ada)'] ||
          obj['jumlah potongan pinjaman'] ||
          obj['potongan_pinjaman'] ||
          obj['potongan_gaji'] ||
          obj['potongan'] ||
          '0';

        const rawSalary = parseFloat(rawSalaryStr.replace(/[^\d.]/g, '')) || 0;
        const rawLoanDeduction = parseFloat(rawLoanStr.replace(/[^\d.]/g, '')) || 0;

        // Net base salary = Gaji - Potongan Pinjaman
        let netSalary = Math.max(0, rawSalary - rawLoanDeduction);

        // Cap with env limit if configured (e.g. VITE_EWA_MAX_BASE_SALARY = 10000000)
        const maxCapEnv = (import.meta as any).env?.VITE_EWA_MAX_BASE_SALARY;
        if (maxCapEnv) {
          const cap = parseFloat(maxCapEnv);
          if (!isNaN(cap) && cap > 0) {
            netSalary = Math.min(netSalary, cap);
          }
        }

        const rawContractEnd =
          obj['tanggal berakhir kontrak'] ||
          obj['tanggal_berakhir_kontrak'] ||
          obj['contract_end_date'] ||
          obj['tgl_kontrak_berakhir'] ||
          obj['berakhir_kontrak'] ||
          '';
        const contractEndDate = rawContractEnd ? rawContractEnd.trim().slice(0, 10) : null;

        const nip = obj['emp. id'] || obj['nip'] || obj['no_karyawan'] || obj['employee_id'] || '';
        const name = obj['nama lengkap karyawan'] || obj['nama'] || obj['name'] || '';
        const email = obj['email'] || '';

        if (!nip || !name || !email) {
          continue; // Skip invalid row
        }

        items.push({
          nip,
          nik: obj['no. ktp'] || obj['nik'] || obj['ktp'] || null,
          name,
          email,
          phone: obj['no. hp'] || obj['telepon'] || obj['phone'] || obj['no_hp'] || null,
          department: obj['departemen'] || obj['department'] || obj['divisi'] || null,
          position: obj['posisi/jabatan'] || obj['jabatan'] || obj['position'] || null,
          baseSalary: netSalary,
          bankName: obj['bank payroll'] || obj['bank'] || obj['nama_bank'] || null,
          bankAccountNumber: obj['no. rekening'] || obj['rekening'] || obj['no_rekening'] || null,
          bankAccountName:
            obj['nama di rekening'] ||
            obj['nama_rekening'] ||
            obj['atas_nama'] ||
            name,
          contractEndDate,
        });
      }

      if (items.length === 0) {
        setImportError('Tidak ada data karyawan yang valid untuk diimpor. Pastikan kolom NIP, Nama, dan Email terisi.');
        setImportLoading(false);
        return;
      }

      const res = await apiFetch('/api/v1/ewa/employees/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (data.success) {
        setImportSuccess(`Berhasil memproses ${data.data?.processedCount ?? items.length} karyawan!`);
        setTimeout(() => {
          setShowImportModal(false);
          setImportCsvText('');
          setImportSuccess('');
          setActiveTab('employees');
          fetchEmployees();
        }, 1500);
      } else {
        const errorMsg =
          data.message ||
          data.error ||
          (data.errors ? 'Validasi data gagal: periksa format email dan data baris' : 'Gagal mengimpor data karyawan');
        setImportError(errorMsg);
      }
    } catch (err: any) {
      console.error('Import CSV error:', err);
      setImportError(err?.message || 'Format CSV tidak valid atau terjadi kegagalan jaringan');
    } finally {
      setImportLoading(false);
    }
  };

  // Table Columns - Requests
  const requestColumns: TableColumn<EWARequest>[] = useMemo(
    () => [
      {
        key: 'date',
        header: 'Tanggal',
        width: pixel(110),
        renderCell: (r: EWARequest) => (
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
        key: 'employee',
        header: 'Karyawan',
        width: proportional(1.5),
        renderCell: (r: EWARequest) => (
          <VStack gap={0}>
            <Text type="body" weight="medium">
              {r.employeeName}
            </Text>
            <HStack gap={1} vAlign="center">
              <Text type="supporting" color="secondary">
                NIP: {r.employeeNip || '-'}
              </Text>
              <Badge variant={r.isMember ? 'success' : 'neutral'} size="sm" label={r.isMember ? 'Anggota' : 'Non-Anggota'} />
            </HStack>
          </VStack>
        ),
      },
      {
        key: 'amount',
        header: 'Nominal Tarik',
        width: proportional(1.2),
        renderCell: (r: EWARequest) => (
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
        key: 'deduction',
        header: 'Potong Payroll',
        width: proportional(1.2),
        renderCell: (r: EWARequest) => (
          <Text type="body" weight="bold">
            {formatRp(r.totalPayrollDeduction)}
          </Text>
        ),
      },
      {
        key: 'bank',
        header: 'Rekening Tujuan',
        width: proportional(1.5),
        renderCell: (r: EWARequest) => (
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
        key: 'status',
        header: 'Status',
        width: pixel(130),
        renderCell: (r: EWARequest) => {
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
          return <Badge variant={variant} label={label} />;
        },
      },
      {
        key: 'action',
        header: 'Aksi',
        width: pixel(180),
        renderCell: (r: EWARequest) =>
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
        key: 'nip',
        header: 'NIP / NIK',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => (
          <VStack gap={0}>
            <Text type="body" weight="medium">{e.nip}</Text>
            <Text type="supporting" color="secondary">{e.nik || '-'}</Text>
          </VStack>
        ),
      },
      {
        key: 'name',
        header: 'Nama & Email',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => (
          <VStack gap={0}>
            <Text type="body" weight="semibold">{e.name}</Text>
            <Text type="supporting" color="secondary">{e.email}</Text>
          </VStack>
        ),
      },
      {
        key: 'dept',
        header: 'Departemen / Posisi',
        width: proportional(1.2),
        renderCell: (e: CompanyEmployee) => (
          <VStack gap={0}>
            <Text type="body">{e.department || '-'}</Text>
            <Text type="supporting" color="secondary">{e.position || '-'}</Text>
          </VStack>
        ),
      },
      {
        key: 'salary',
        header: 'Gaji & Plafon',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => {
          const effective = e.effectiveSalary ?? e.baseSalary;
          const loanDed = e.coopLoanDeduction ?? 0;
          const dailyLimit = e.dailyAccumulatedLimit ?? Math.floor(effective * 0.5);
          return (
            <VStack gap={0}>
              <Text type="body" weight="semibold">{formatRp(e.baseSalary)}</Text>
              {loanDed > 0 && (
                <Text type="supporting" color="critical" style={{ fontSize: 11 }}>
                  Angsuran Pinjaman: -{formatRp(loanDed)}
                </Text>
              )}
              <Text type="supporting" color="primary" style={{ fontSize: 11, fontWeight: 600 }}>
                Plafon Hari Ini: {formatRp(dailyLimit)}
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 10 }}>
                (Maks Sebulan: {formatRp(Math.floor(effective * 0.5))})
              </Text>
            </VStack>
          );
        },
      },
      {
        key: 'status',
        header: 'Status Koperasi',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => (
          <Badge variant={e.isMember ? 'success' : 'neutral'} label={e.isMember ? 'Anggota Koperasi' : 'Bukan Anggota'} />
        ),
      },
      {
        key: 'contract',
        header: 'Masa Kontrak',
        width: pixel(140),
        renderCell: (e: CompanyEmployee) => {
          if (!e.contractEndDate) {
            return <Badge variant="neutral" label="Karyawan Tetap" />;
          }
          const today = new Date().toISOString().slice(0, 10);
          const endStr = String(e.contractEndDate).slice(0, 10);
          const isExpired = today > endStr;
          return (
            <VStack gap={0}>
              <Badge variant={isExpired ? 'critical' : 'warning'} size="sm" label={isExpired ? 'Kontrak Berakhir' : 'Kontrak Aktif'} />
              <Text type="supporting" color={isExpired ? 'critical' : 'secondary'} style={{ fontSize: 11 }}>
                s/d {endStr}
              </Text>
            </VStack>
          );
        },
      },
      {
        key: 'bank',
        header: 'Rekening Payroll',
        width: proportional(1.5),
        renderCell: (e: CompanyEmployee) => (
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
              { id: 'requests' as const, label: 'Pengajuan & Pencairan', count: requests.length, icon: BanknotesIcon },
              { id: 'employees' as const, label: 'Master Karyawan & Gaji', count: employees.length, icon: UserGroupIcon },
              { id: 'payroll' as const, label: 'Rekap Potongan Payroll (HRD)', count: payrollRecap?.totalEmployees || 0, icon: DocumentArrowDownIcon },
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
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                      {tab.count}
                    </Badge>
                  )}
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
                      Mendukung format ekspor HRIS / Wagely (<code>Nama Lengkap Karyawan, No. KTP, Emp. ID, Jumlah Gaji, dll.</code>) maupun format standar.
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

                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center">
                        <Text type="supporting" style={{ fontWeight: 500 }}>Pilih File CSV:</Text>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleFileUpload}
                          style={{ fontSize: 13 }}
                        />
                      </HStack>
                      <Text type="supporting" color="secondary">atau tempel isi teks CSV di bawah ini:</Text>
                    </VStack>

                    <textarea
                      rows={8}
                      required
                      placeholder={`Nama Lengkap Karyawan,No. KTP,Emp. ID,Email,No. HP,Bank Payroll,No. Rekening,Nama di rekening,Posisi/Jabatan,Jumlah Gaji\nBudi Santoso,1271111310970003,0202169,budi@nusa.id,6282370071235,Bank Mandiri,1060015016754,Budi Santoso,Engineer,"3,219,069"`}
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
