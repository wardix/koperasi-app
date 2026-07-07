'use client';

import {useState, useMemo, useEffect} from 'react';
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
import {formatRp} from './utils';
import {useToast} from '@astryxdesign/core/Toast';
import {apiFetch} from './config';
import {useApiQuery} from './hooks/useApiQuery';
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
import {useImperativeDialog} from '@astryxdesign/core/Dialog';
import {AddLoanDialogContent} from './AddLoanDialog.tsx';
import {LoanDetailDialogContent} from './LoanDetailDialog.tsx';


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
  const dialog = useImperativeDialog({purpose: 'form', width: 480});
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: loansResponse, isLoading, error, refetch: fetchLoans } = useApiQuery<PaginatedResponse<LoanRow>>(`/api/loans?page=${page}&limit=${limit}`);
  const [localLoans, setLocalLoans] = useState<LoanRow[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (loansResponse?.data) {
      setLocalLoans(loansResponse.data);
    }
  }, [loansResponse]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await apiFetch(`/api/loans/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setLocalLoans(localLoans.map(loan => loan.id === id ? { ...loan, status } : loan));
        toast.show({body: 'Status pinjaman berhasil diperbarui', type: 'info'});
      } else {
        toast.show({body: 'Gagal memperbarui status', type: 'error'});
      }
    } catch (err) {
      console.error("Error updating loan status:", err);
      toast.show({body: 'Terjadi kesalahan sistem', type: 'error'});
    }
  };

  const filtered = useMemo(() => {
    return applyFilters(filters, localLoans);
  }, [filters, applyFilters, localLoans]);

  const handleAddLoan = () => {
    dialog.show(
      <AddLoanDialogContent
        onClose={() => dialog.hide()}
        onAdd={async (newLoan) => {
          try {
            const res = await apiFetch('/api/loans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLoan)
            });
            if (res.ok) {
              toast.show({body: 'Pinjaman berhasil diajukan', type: 'info'});
              fetchLoans();
            } else {
              toast.show({body: 'Gagal menambahkan pengajuan pinjaman', type: 'error'});
            }
          } catch (err) {
            console.error("Error saving loan:", err);
            toast.show({body: 'Terjadi kesalahan sistem', type: 'error'});
          }
        }}
      />
    );
  };

  const columns: TableColumn<LoanRow>[] = [
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
          <Text type="body">{'Rp ' + item.amount.toLocaleString('id-ID')}</Text>
          {item.status === 'Disetujui' && (
            <Text type="supporting" color={item.amount - (item.paidAmount || 0) > 0 ? 'error' : 'success'} style={{ fontSize: '12px' }}>
              Sisa: Rp {Math.max(0, item.amount - (item.paidAmount || 0)).toLocaleString('id-ID')}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'tenor',
      header: 'Tenor',
      width: pixel(100),
      renderCell: (item: LoanRow) => <Text type="body">{item.tenor}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        let color = 'neutral';
        if (item.status === 'Disetujui') color = 'success';
        if (item.status === 'Ditolak') color = 'error';
        if (item.status === 'Menunggu') color = 'warning';
        return <Badge color={color as any}>{item.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(120),
      renderCell: (item: LoanRow) => {
        return (
          <HStack gap={2}>
            {item.status === 'Menunggu' && (
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
  ];

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
            <Button
              label="Tambah Pengajuan"
              icon={<Icon icon={PlusIcon} size="sm" />}
              onClick={handleAddLoan}
            />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          {isLoading ? (
            <Center style={{height: '100%'}}>
              <Spinner size="large" />
            </Center>
          ) : error ? (
            <Center style={{height: '100%'}}>
              <EmptyState
                icon={<ExclamationCircleIcon width={48} height={48} />}
                title="Gagal Memuat Data Pinjaman"
                description={error}
                actions={<Button label="Coba Lagi" onClick={fetchLoans} />}
              />
            </Center>
          ) : (
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
            <HStack hAlign="between" vAlign="center" padding={2}>
              <Text type="body">Halaman {loansResponse?.page || 1} dari {Math.ceil((loansResponse?.total || 0) / (loansResponse?.limit || 20)) || 1}</Text>
              <HStack gap={2}>
                <Button 
                  label="Sebelumnya" 
                  variant="outline" 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                />
                <Button 
                  label="Selanjutnya" 
                  variant="outline" 
                  disabled={page >= Math.ceil((loansResponse?.total || 0) / limit)}
                  onClick={() => setPage(p => p + 1)} 
                />
              </HStack>
            </HStack>
          </VStack>
          )}
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
