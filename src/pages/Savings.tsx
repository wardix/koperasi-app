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
import {Text, Heading} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {useApiQuery} from '../hooks/useApiQuery';
import {formatRp} from '../utils/format';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {ImportSavingsDialogContent} from '../components/ImportSavingsDialog';
import {useAuth} from '../hooks/useAuth';

import type {SavingsTransactionRow, PaginatedResponse} from '../shared/types';

const transactionTypeValues = [
  {value: 'setor_pokok', label: 'Setor Pokok'},
  {value: 'setor_wajib', label: 'Setor Wajib'},
  {value: 'setor_sukarela', label: 'Setor Sukarela'},
  {value: 'tarik_pokok', label: 'Tarik Pokok'},
  {value: 'tarik_wajib', label: 'Tarik Wajib'},
  {value: 'tarik_sukarela', label: 'Tarik Sukarela'},
];

const fieldDefs = [
  {key: 'memberName', type: 'string', label: 'Nama Anggota'},
  {key: 'type', type: 'enum', label: 'Tipe Transaksi', enumValues: transactionTypeValues},
] as const;

export default function SavingsTemplate() {
  const dialog = useA11yDialog({purpose: 'form', width: 600});
  const {hasPermission} = useAuth();
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Simpanan');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: transactionsResponse, isLoading, error, refetch: fetchTransactions } = useApiQuery<PaginatedResponse<SavingsTransactionRow>>(`/api/savings/transactions?page=${page}&limit=${limit}`);
  const [localTransactions, setLocalTransactions] = useState<SavingsTransactionRow[]>([]);

  useEffect(() => {
    if (transactionsResponse?.data) {
      setLocalTransactions(transactionsResponse.data);
    }
  }, [transactionsResponse]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localTransactions);
  }, [filters, applyFilters, localTransactions]);

  const columns: TableColumn<SavingsTransactionRow>[] = useMemo(() => [
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body">{item.memberName || 'Anggota Koperasi'}</Text>
      ),
    },
    {
      key: 'type',
      header: 'Tipe Transaksi',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => {
        let label = item.type;
        let variant: 'success' | 'error' | 'neutral' | 'warning' = 'neutral';

        const match = transactionTypeValues.find(t => t.value === item.type);
        if (match) {
          label = match.label;
        }

        if (item.type.startsWith('setor_')) {
          variant = 'success';
        } else if (item.type.startsWith('tarik_')) {
          variant = 'error';
        }

        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" style={{ fontWeight: 500, color: item.type.startsWith('setor_') ? '#10b981' : '#ef4444' }}>
          {item.type.startsWith('setor_') ? '+' : '-'} {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'balanceBefore',
      header: 'Saldo Sebelum',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" color="secondary">{formatRp(item.balanceBefore)}</Text>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Sesudah',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" style={{ fontWeight: 500 }}>{formatRp(item.balanceAfter)}</Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Waktu',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">
          {new Date(item.createdAt).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ),
    },
    {
      key: 'createdBy',
      header: 'Petugas',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">{item.createdBy}</Text>
      ),
    },
  ], []);

  return (
    <>
      <Layout
        height="auto"
        header={
          <LayoutHeader hasDivider>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill">
                <Heading level={1}>Riwayat Transaksi Simpanan</Heading>
              </StackItem>
              {hasPermission('update:savings') && (
                <Button
                  label="Import CSV Simpanan"
                  variant="secondary"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  onClick={() => {
                    dialog.show(
                      <ImportSavingsDialogContent
                        onClose={() => dialog.hide()}
                        onSuccess={() => fetchTransactions()}
                      />
                    );
                  }}
                />
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={3}>
            <DataStateView isLoading={isLoading} error={error} onRetry={fetchTransactions} errorTitle="Gagal Memuat Riwayat Transaksi">
              <VStack gap={4}>
                <PowerSearch
                  config={config}
                  filters={filters}
                  onChange={newFilters => {
                    setFilters([...newFilters]);
                  }}
                  placeholder="Cari transaksi..."
                  resultCount={filtered.length}
                />
                <Table<SavingsTransactionRow>
                  data={filtered}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
                />
                <Pagination
                  page={transactionsResponse?.page || 1}
                  limit={transactionsResponse?.limit || limit}
                  total={transactionsResponse?.total || 0}
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
