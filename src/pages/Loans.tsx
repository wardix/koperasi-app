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
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {
  FunnelIcon,
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

const statusValues = [
  {value: 'Menunggu', label: 'Menunggu'},
  {value: 'Disetujui', label: 'Disetujui'},
  {value: 'Ditolak', label: 'Ditolak'},
];

const fieldDefs = [
  {key: 'name', type: 'string', label: 'Nama Peminjam'},
  {key: 'status', type: 'enum', label: 'Status', enumValues: statusValues},
] as const;

export default function LoansTemplate() {
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Pinjaman');
  const dialog = useA11yDialog({purpose: 'form', width: 520, maxHeight: '85vh'});
  const toast = useToast();
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: loansResponse, isLoading, error, refetch: fetchLoans } = useApiQuery<PaginatedResponse<LoanRow>>(`/api/loans?page=${page}&limit=${limit}`);
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

  const filtered = useMemo(() => {
    return applyFilters(filters, localLoans);
  }, [filters, applyFilters, localLoans]);

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
            <Text type="body">{item.name}</Text>
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
            <IconButton
              label="Filter"
              icon={<Icon icon={FunnelIcon} size="sm" />}
              variant="ghost"
            />
            {hasPermission('export:reports') && (
              <>
                <IconButton
                  label="Unduh"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={() => {
                    if (localLoans.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
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
                    exportToExcel(localLoans, columns, `Data_Pinjaman_${new Date().toISOString().slice(0,10)}`);
                  }}
                />
                <IconButton
                  label="Cetak PDF"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={() => {
                    if (localLoans.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
                    const columns = [
                      { header: 'Nama Peminjam', key: 'name' },
                      { header: 'Status', key: 'status' },
                      { header: 'Tenor', key: 'tenor', render: (item: any) => `${item.tenor} Bln` },
                      { header: 'Pinjaman', key: 'amount', render: (item: any) => formatRp(item.amount) },
                      { header: 'Sisa', key: 'remainingAmount', render: (item: any) => formatRp(Math.max(0, (item.totalAmount ?? item.amount) - (item.paidAmount || 0))) }
                    ];
                    exportToPDF(localLoans, columns, `Laporan_Pinjaman_${new Date().toISOString().slice(0,10)}`, 'DAFTAR PINJAMAN KOPERASI');
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
            <PowerSearch
              config={config}
              filters={filters}
              onChange={newFilters => {
                setFilters([...newFilters]);
              }}
              placeholder="Cari pengajuan..."
              resultCount={filtered.length}
            />
            <Table<LoanRow>
              data={filtered}
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
