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
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {useApiQuery} from '../hooks/useApiQuery';
import {formatRp} from '../utils/format';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';

import type {CashflowRow, CashflowResponse} from '../shared/types';

const flowTypeValues = [
  {value: 'inflow', label: 'Arus Masuk (Inflow)'},
  {value: 'outflow', label: 'Arus Keluar (Outflow)'},
];

const fieldDefs = [
  {key: 'partyName', type: 'string', label: 'Nama Anggota / Pihak Kedua'},
  {key: 'flowType', type: 'enum', label: 'Tipe Arus', enumValues: flowTypeValues},
] as const;

export default function CashflowTemplate() {
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Buku Kas');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: cashflowResponse, isLoading, error, refetch: fetchCashflow } = useApiQuery<CashflowResponse>(`/api/cashflow?page=${page}&limit=${limit}`);
  const [localLedger, setLocalLedger] = useState<CashflowRow[]>([]);

  useEffect(() => {
    if (cashflowResponse?.data) {
      setLocalLedger(cashflowResponse.data);
    }
  }, [cashflowResponse]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localLedger);
  }, [filters, applyFilters, localLedger]);

  const summary = useMemo(() => {
    return cashflowResponse?.summary || { totalInflow: 0, totalOutflow: 0, netCash: 0 };
  }, [cashflowResponse]);

  const columns: TableColumn<CashflowRow>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Waktu',
      width: proportional(2),
      renderCell: (item: CashflowRow) => (
        <Text type="supporting" color="secondary">
          {new Date(item.date).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ),
    },
    {
      key: 'partyName',
      header: 'Anggota / Pihak Kedua',
      width: proportional(2),
      renderCell: (item: CashflowRow) => (
        <Text type="body">{item.partyName || '-'}</Text>
      ),
    },
    {
      key: 'description',
      header: 'Keterangan',
      width: proportional(2.5),
      renderCell: (item: CashflowRow) => {
        let desc = item.description;
        if (item.source === 'savings') {
          const cleanDesc = item.description.replace('setor_', 'Setor ').replace('tarik_', 'Tarik ');
          desc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
        }
        return <Text type="body">{desc}</Text>;
      },
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1.5),
      renderCell: (item: CashflowRow) => (
        <Text type="body" style={{ fontWeight: 500, color: item.flowType === 'inflow' ? 'var(--color-success, #10b981)' : 'var(--color-error, #ef4444)' }}>
          {item.flowType === 'inflow' ? '+' : '-'} {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'flowType',
      header: 'Arus',
      width: proportional(1.5),
      renderCell: (item: CashflowRow) => {
        const variant = item.flowType === 'inflow' ? 'success' : 'error';
        const label = item.flowType === 'inflow' ? 'Masuk' : 'Keluar';
        return <Badge variant={variant} label={label} />;
      },
    },
  ], []);

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Arus Kas Koperasi</Heading>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchCashflow} errorTitle="Gagal Memuat Arus Kas">
            <VStack gap={4}>
              <Grid columns={{minWidth: 240, repeat: 'fit'}} gap={4}>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Total Arus Masuk</Text>
                    <Heading level={2} style={{ color: 'var(--color-success, #10b981)' }}>{formatRp(summary.totalInflow)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Total Arus Keluar</Text>
                    <Heading level={2} style={{ color: 'var(--color-error, #ef4444)' }}>{formatRp(summary.totalOutflow)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Saldo Kas Bersih</Text>
                    <Heading level={2} style={{ color: summary.netCash >= 0 ? 'var(--color-success, #10b981)' : 'var(--color-error, #ef4444)' }}>
                      {formatRp(summary.netCash)}
                    </Heading>
                  </VStack>
                </Card>
              </Grid>

              <PowerSearch
                config={config}
                filters={filters}
                onChange={newFilters => {
                  setFilters([...newFilters]);
                }}
                placeholder="Cari buku kas..."
                resultCount={filtered.length}
              />
              <Table<CashflowRow>
                data={filtered}
                columns={columns}
                idKey="id"
                density="balanced"
                dividers="rows"
                hasHover
              />
              <Pagination
                page={cashflowResponse?.page || 1}
                limit={cashflowResponse?.limit || limit}
                total={cashflowResponse?.total || 0}
                onPageChange={setPage}
              />
            </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
  );
}
