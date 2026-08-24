'use client';

import {useState, useMemo, useEffect, useCallback} from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,

} from '@astryxdesign/core/Layout';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon} from '@heroicons/react/24/outline';
import {useToast} from '@astryxdesign/core/Toast';
import {api} from '../services/api';
import {useApiQuery} from '../hooks/useApiQuery';
import {useAuth} from '../hooks/useAuth';
import {useApiAction} from '../hooks/useApiAction';
import {formatRp} from '../utils/format';
import {exportToExcel, exportToPDF} from '../utils/exportUtils';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  EyeIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import {useA11yDialog} from '../hooks/useA11yDialog';
import { lazy, Suspense } from 'react';

const AddLoanDialogContent = lazy(() => import('../components/AddLoanDialog').then(m => ({ default: m.AddLoanDialogContent })));
const ApproveLoanDialogContent = lazy(() => import('../components/ApproveLoanDialog').then(m => ({ default: m.ApproveLoanDialogContent })));
const LoanDetailDialogContent = lazy(() => import('../components/LoanDetailDialog').then(m => ({ default: m.LoanDetailDialogContent })));
const ImportLoansDialogContent = lazy(() => import('../components/ImportLoansDialog').then(m => ({ default: m.ImportLoansDialogContent })));
const ImportSchedulesDialogContent = lazy(() => import('../components/ImportSchedulesDialog').then(m => ({ default: m.ImportSchedulesDialogContent })));

import type {LoanRow, PaginatedResponse} from '../shared/types';

const statusOptions = [
  {value: '', label: 'Semua Status'},
  {value: 'Menunggu', label: 'Menunggu Persetujuan'},
  {value: 'Disetujui', label: 'Disetujui'},
  {value: 'Ditolak', label: 'Ditolak'},
  {value: 'Lunas', label: 'Lunas'},
  {value: 'Macet', label: 'Macet'},
];

export default function LoansTemplate() {
  const dialog = useA11yDialog({purpose: 'form', width: 520, maxHeight: '85vh'});
  const toast = useToast();
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (statusFilter) queryParams.set('status', statusFilter);

  const { data: loansResponse, isLoading, error, refetch: fetchLoans } = useApiQuery<PaginatedResponse<LoanRow>>(`/api/loans?${queryParams.toString()}`);
  const loans = loansResponse?.data || [];
  const [localLoans, setLocalLoans] = useState<LoanRow[]>([]);

  useEffect(() => {
    if (loansResponse?.data) {
      setLocalLoans(loansResponse.data);
    }
  }, [loansResponse]);

  const handleUpdateStatus = useCallback(
    (
      id: string,
      status: string,
      options?: { approvedDate?: string; interestRate?: number }
    ) => {
      apiAction.execute(
        () =>
          api.put(`/api/loans/${id}/status`, {
            status,
            ...(options?.approvedDate ? { approvedDate: options.approvedDate } : {}),
            ...(options?.interestRate != null ? { interestRate: options.interestRate } : {}),
          }),
        {
          successMsg: 'Status pinjaman berhasil diperbarui',
          errorMsg: 'Terjadi kesalahan sistem',
          onSuccess: () => {
            setLocalLoans((loans) =>
              loans.map((loan) => (loan.id === id ? { ...loan, status } : loan))
            );
            fetchLoans();
          },
        }
      );
    },
    [apiAction, fetchLoans]
  );

  const handleApproveLoan = useCallback(
    (loan: LoanRow) => {
      dialog.show(
        <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
          <ApproveLoanDialogContent
            loan={loan}
            onClose={() => dialog.hide()}
            onConfirm={({ approvedDate, interestRate }) => {
              handleUpdateStatus(loan.id, 'Disetujui', { approvedDate, interestRate });
              dialog.hide();
            }}
          />
        </Suspense>
      );
    },
    [dialog, handleUpdateStatus]
  );

  const handleAddLoan = useCallback(() => {
    dialog.show(
      <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
        <AddLoanDialogContent
          onClose={() => dialog.hide()}
          onAdd={(newLoan) => {
            apiAction.execute(
              () => api.post('/api/loans', newLoan),
              {
                successMsg: 'Pinjaman berhasil diajukan',
                errorMsg: 'Terjadi kesalahan sistem',
                onSuccess: () => fetchLoans(),
                onFinally: () => dialog.hide()
              }
            );
          }}
        />
      </Suspense>
    );
  }, [dialog, apiAction, fetchLoans]);

  const handleImportLoans = useCallback(() => {
    dialog.show(
      <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
        <ImportLoansDialogContent
          onClose={() => dialog.hide()}
          onSuccess={() => fetchLoans()}
        />
      </Suspense>
    );
  }, [dialog, fetchLoans]);

  const handleImportSchedules = useCallback(() => {
    dialog.show(
      <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
        <ImportSchedulesDialogContent
          onClose={() => dialog.hide()}
          onSuccess={() => fetchLoans()}
        />
      </Suspense>
    );
  }, [dialog, fetchLoans]);

  const handleDeleteLoan = useCallback((loan: LoanRow) => {
    dialog.show(
      <Card style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        <VStack gap={4}>
          <Heading level={4}>Konfirmasi Hapus</Heading>
          <Text type="body">Apakah Anda yakin ingin menghapus data pengajuan pinjaman untuk {loan.name} senilai {formatRp(loan.amount)}?</Text>
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Batal" onClick={() => dialog.hide()} />
            <Button color="error" label="Hapus" onClick={() => {
              apiAction.execute(
                () => api.delete(`/api/loans/${loan.id}`),
                {
                  successMsg: 'Pengajuan pinjaman berhasil dihapus',
                  errorMsg: 'Gagal menghapus pengajuan pinjaman',
                  onSuccess: () => {
                    dialog.hide();
                    setTimeout(() => {
                      fetchLoans();
                    }, 100);
                  },
                  onFinally: () => dialog.hide()
                }
              );
            }} />
          </HStack>
        </VStack>
      </Card>
    );
  }, [dialog, apiAction, fetchLoans]);

  const columns: TableColumn<LoanRow>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nama Peminjam',
      width: proportional(2),
      renderCell: (item: LoanRow) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={item.name} size="small" />
          <VStack gap={0}>
            <HStack vAlign="center" gap={2}>
              <Text type="body" weight="semibold">{item.name}</Text>
              {item.attachmentUrl && (
                <a
                  href={item.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`Lampiran: ${item.attachmentName || 'Dokumen'}`}
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    color: 'var(--color-primary-500, #0171E3)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  📎 {item.attachmentName?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Lampiran'}
                </a>
              )}
            </HStack>
            <Text type="supporting" color="secondary">
              {item.purpose}
            </Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'amount',
      header: 'Jumlah Pinjaman',
      width: proportional(1),
      renderCell: (item: LoanRow) => (
        <VStack gap={1}>
          <Text type="body">{formatRp(item.amount)}</Text>
          {item.status === 'Disetujui' && (
            <Text type="supporting" color={(item.totalAmount ?? item.amount) - (item.paidAmount || 0) > 0 ? 'error' : 'success'} style={{ fontSize: '12px' }}>
              Sisa: {formatRp(Math.max(0, (item.totalAmount ?? item.amount) - (item.paidAmount || 0)))}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'tenor',
      header: 'Tenor',
      width: pixel(100),
      renderCell: (item: LoanRow) => <Text type="body">{item.tenor} Bulan</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        let variant: 'neutral' | 'success' | 'error' | 'warning' = 'neutral';
        if (item.status === 'Disetujui') variant = 'success';
        if (item.status === 'Ditolak') variant = 'error';
        if (item.status === 'Menunggu') variant = 'warning';
        return <Badge variant={variant} label={item.status} />;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(160),
      renderCell: (item: LoanRow) => {
        return (
          <HStack gap={2}>
            {hasPermission('approve:loans') && item.status === 'Menunggu' && (
              <>
                <IconButton icon={<Icon icon={CheckIcon} />} label="Setujui" variant="primary" size="sm" onClick={() => handleApproveLoan(item)} />
                <IconButton icon={<Icon icon={XMarkIcon} />} label="Tolak" variant="secondary" size="sm" onClick={() => handleUpdateStatus(item.id, 'Ditolak')} />
              </>
            )}
            {(item.status === 'Disetujui' || item.status === 'Lunas') && (
              <IconButton 
                icon={<Icon icon={EyeIcon} />} 
                label="Detail" 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  dialog.show(
                    <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
                      <LoanDetailDialogContent 
                        loan={item} 
                        onClose={() => dialog.hide()} 
                        onUpdate={() => fetchLoans()} 
                      />
                    </Suspense>
                  );
                }} 
              />
            )}
            {hasPermission('delete:loans') && (
              <IconButton 
                icon={<Icon icon={TrashIcon} />} 
                label="Hapus" 
                variant="ghost" 
                color="error" 
                size="sm" 
                onClick={() => handleDeleteLoan(item)} 
              />
            )}
          </HStack>
        );
      },
    },
  ], [hasPermission, handleUpdateStatus, handleApproveLoan, dialog, fetchLoans, handleDeleteLoan]);

  return (
    <>
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Persetujuan Pinjaman</Heading>
            </StackItem>
            {hasPermission('export:reports') && (
              <>
                <IconButton
                  label="Unduh"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={async () => {
                    if (loans.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
                    try {
                      const exportParams = new URLSearchParams({ all: 'true' });
                      if (debouncedSearch) exportParams.set('search', debouncedSearch);
                      if (statusFilter) exportParams.set('status', statusFilter);
                      const res = await api.get<{ data: LoanRow[] }>(`/api/loans?${exportParams.toString()}`);
                      const dataToExport = res?.data || loans;
                      const columns = [
                        { header: 'Nama Peminjam', key: 'name' },
                        { header: 'Keperluan', key: 'purpose' },
                        { header: 'Status', key: 'status' },
                        { header: 'Tenor (Bulan)', key: 'tenor' },
                        { header: 'Jumlah Pinjaman', key: 'amount', render: (item: any) => formatRp(item.amount) },
                        { header: 'Total Tagihan', key: 'totalAmount', render: (item: any) => formatRp(item.totalAmount || item.amount) },
                        { header: 'Telah Dibayar', key: 'paidAmount', render: (item: any) => formatRp(item.paidAmount || 0) },
                        { header: 'Sisa Pinjaman', key: 'remainingAmount', render: (item: any) => formatRp(Math.max(0, (item.totalAmount ?? item.amount) - (item.paidAmount || 0))) }
                      ];
                      exportToExcel(dataToExport, columns, `Data_Pinjaman_${new Date().toISOString().slice(0,10)}`);
                    } catch {
                      toast.show({ type: 'error', message: 'Gagal mengekspor data' });
                    }
                  }}
                />
                <IconButton
                  label="Cetak PDF"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={async () => {
                    if (loans.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
                    try {
                      const exportParams = new URLSearchParams({ all: 'true' });
                      if (debouncedSearch) exportParams.set('search', debouncedSearch);
                      if (statusFilter) exportParams.set('status', statusFilter);
                      const res = await api.get<{ data: LoanRow[] }>(`/api/loans?${exportParams.toString()}`);
                      const dataToExport = res?.data || loans;
                      const columns = [
                        { header: 'Nama Peminjam', key: 'name' },
                        { header: 'Status', key: 'status' },
                        { header: 'Tenor', key: 'tenor', render: (item: any) => `${item.tenor} Bln` },
                        { header: 'Pinjaman', key: 'amount', render: (item: any) => formatRp(item.amount) },
                        { header: 'Sisa', key: 'remainingAmount', render: (item: any) => formatRp(Math.max(0, (item.totalAmount ?? item.amount) - (item.paidAmount || 0))) }
                      ];
                      exportToPDF(dataToExport, columns, `Laporan_Pinjaman_${new Date().toISOString().slice(0,10)}`, 'DAFTAR PINJAMAN KOPERASI');
                    } catch {
                      toast.show({ type: 'error', message: 'Gagal mengekspor PDF' });
                    }
                  }}
                />
              </>
            )}
            {hasPermission('approve:loans') && (
              <Button
                label="Import Jadwal (CSV)"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                variant="secondary"
                onClick={handleImportSchedules}
              />
            )}
            {hasPermission('create:loans') && (
              <Button
                label="Import Pinjaman (CSV)"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                variant="secondary"
                onClick={handleImportLoans}
              />
            )}
            {hasPermission('create:loans') && (
              <Button
                label="Tambah Pengajuan"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={handleAddLoan}
              />
            )}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchLoans} errorTitle="Gagal Memuat Data Pinjaman">
          <VStack gap={4}>
            <HStack gap={3} vAlign="center" style={{ width: '100%' }}>
              <StackItem size="fill">
                <TextInput
                  placeholder="Cari nama peminjam atau keperluan pinjaman..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </StackItem>
              <StackItem style={{ width: '220px' }}>
                <Selector
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                />
              </StackItem>
            </HStack>
            <Table<LoanRow>
              data={loans}
              columns={columns}
              idKey="id"
              density="balanced"
              dividers="rows"
              hasHover
            />
            <Pagination
              page={loansResponse?.page || 1}
              limit={loansResponse?.limit || limit}
              total={loansResponse?.total || 0}
              onPageChange={setPage}
            />
          </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
