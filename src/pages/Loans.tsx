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
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
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
} from '@heroicons/react/24/outline';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {AddLoanDialogContent} from '../components/AddLoanDialog';
import {LoanDetailDialogContent} from '../components/LoanDetailDialog';

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
  const dialog = useA11yDialog({purpose: 'form', width: 480});
  const toast = useToast();
  const { isAdmin } = useAuth();
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

  const handleUpdateStatus = useCallback((id: string, status: string) => {
    console.log("handleUpdateStatus called for id:", id, "status:", status);
    apiAction.execute(
      () => api.put(`/api/loans/${id}/status`, { status }),
      {
        successMsg: 'Status pinjaman berhasil diperbarui',
        errorMsg: 'Terjadi kesalahan sistem',
        onSuccess: () => setLocalLoans(loans => loans.map(loan => loan.id === id ? { ...loan, status } : loan))
      }
    );
  }, [apiAction]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localLoans);
  }, [filters, applyFilters, localLoans]);

  const handleAddLoan = useCallback(() => {
    dialog.show(
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
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        return (
          <HStack gap={2}>
            {isAdmin && item.status === 'Menunggu' && (
              <>
                <IconButton icon={<Icon icon={CheckIcon} />} label="Setujui" variant="primary" size="sm" onClick={() => handleUpdateStatus(item.id, 'Disetujui')} />
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
                    <LoanDetailDialogContent 
                      loan={item} 
                      onClose={() => dialog.hide()} 
                      onUpdate={() => fetchLoans()} 
                    />
                  );
                }} 
              />
            )}
          </HStack>
        );
      },
    },
  ], [isAdmin, handleUpdateStatus, dialog, fetchLoans]);

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
            {isAdmin && (
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
