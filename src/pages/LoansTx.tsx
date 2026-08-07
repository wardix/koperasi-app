'use client';

import {useState, useMemo, useEffect, useCallback, lazy, Suspense} from 'react';
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
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {useApiQuery} from '../hooks/useApiQuery';
import {useAuth} from '../hooks/useAuth';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {formatRp} from '../utils/format';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';

const ImportPaymentsDialogContent = lazy(() => import('../components/ImportPaymentsDialog').then(m => ({ default: m.ImportPaymentsDialogContent })));

import type {LoanPaymentRow, PaginatedResponse} from '../shared/types';

const methodValues = [
  {value: 'Cash', label: 'Cash / Tunai'},
  {value: 'Transfer', label: 'Transfer Bank'},
];

const typeValues = [
  {value: 'pencairan', label: 'Pencairan Pinjaman'},
  {value: 'angsuran', label: 'Angsuran Pinjaman'},
];

const fieldDefs = [
  {key: 'borrowerName', type: 'string', label: 'Nama Anggota'},
  {key: 'type', type: 'enum', label: 'Tipe Transaksi', enumValues: typeValues},
  {key: 'method', type: 'enum', label: 'Metode Pembayaran', enumValues: methodValues},
] as const;

export default function LoansTxTemplate() {
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Pinjaman');
  const { hasPermission } = useAuth();
  const dialog = useA11yDialog({ purpose: 'form', width: 560 });
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: paymentsResponse, isLoading, error, refetch: fetchPayments } = useApiQuery<PaginatedResponse<LoanPaymentRow>>(`/api/loans/payments?page=${page}&limit=${limit}`);
  const [localPayments, setLocalPayments] = useState<LoanPaymentRow[]>([]);

  useEffect(() => {
    if (paymentsResponse?.data) {
      setLocalPayments(paymentsResponse.data);
    }
  }, [paymentsResponse]);

  const handleImportPayments = useCallback(() => {
    dialog.show(
      <Suspense fallback={<Center style={{ padding: 40 }}><Spinner /></Center>}>
        <ImportPaymentsDialogContent
          onClose={() => dialog.hide()}
          onSuccess={() => fetchPayments()}
        />
      </Suspense>
    );
  }, [dialog, fetchPayments]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localPayments);
  }, [filters, applyFilters, localPayments]);

  const columns: TableColumn<LoanPaymentRow>[] = useMemo(() => [
    {
      key: 'borrowerName',
      header: 'Nama Peminjam',
      width: proportional(2),
      renderCell: (item: LoanPaymentRow) => (
        <Text type="body">{item.borrowerName || 'Anggota Koperasi'}</Text>
      ),
    },
    {
      key: 'type',
      header: 'Tipe Transaksi',
      width: proportional(1.5),
      renderCell: (item: LoanPaymentRow) => {
        const isDisbursement = item.type === 'pencairan';
        return (
          <Badge 
            variant={isDisbursement ? 'error' : 'success'} 
            label={isDisbursement ? 'Pencairan' : 'Angsuran'} 
          />
        );
      },
    },
    {
      key: 'amount',
      header: 'Nominal Transaksi',
      width: proportional(1.5),
      renderCell: (item: LoanPaymentRow) => {
        const isDisbursement = item.type === 'pencairan';
        return (
          <Text type="body" style={{ fontWeight: 500, color: isDisbursement ? 'var(--color-critical-500)' : 'var(--color-success-500)' }}>
            {isDisbursement ? '-' : '+'}{formatRp(item.amount)}
          </Text>
        );
      },
    },
    {
      key: 'method',
      header: 'Metode Pembayaran',
      width: proportional(2),
      renderCell: (item: LoanPaymentRow) => {
        const match = methodValues.find(m => m.value === item.method);
        const label = match ? match.label : item.method;
        const variant = item.method === 'Transfer' ? 'success' : 'neutral';
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'paymentDate',
      header: 'Tanggal Transaksi',
      width: proportional(2.5),
      renderCell: (item: LoanPaymentRow) => (
        <Text type="supporting" color="secondary">
          {new Date(item.paymentDate).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
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
                <Heading level={1}>Riwayat Transaksi Pinjaman</Heading>
              </StackItem>
              {hasPermission('create:payments') && (
                <Button
                  label="Import Angsuran (CSV)"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="secondary"
                  onClick={handleImportPayments}
                />
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={3}>
            <DataStateView isLoading={isLoading} error={error} onRetry={fetchPayments} errorTitle="Gagal Memuat Riwayat Pembayaran">
              <VStack gap={4}>
                <PowerSearch
                  config={config}
                  filters={filters}
                  onChange={newFilters => {
                    setFilters([...newFilters]);
                  }}
                  placeholder="Cari transaksi pembayaran..."
                  resultCount={filtered.length}
                />
                <Table<LoanPaymentRow>
                  data={filtered}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
                />
                <Pagination
                  page={paymentsResponse?.page || 1}
                  limit={paymentsResponse?.limit || limit}
                  total={paymentsResponse?.total || 0}
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
