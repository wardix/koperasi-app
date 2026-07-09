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

import type {NplRow, NplResponse} from '../shared/types';

const fieldDefs = [
  {key: 'name', type: 'string', label: 'Nama Anggota'},
  {key: 'purpose', type: 'string', label: 'Tujuan Pinjaman'},
] as const;

export default function NPLTemplate() {
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Kredit Macet');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: nplResponse, isLoading, error, refetch: fetchNpl } = useApiQuery<NplResponse>(`/api/npl?page=${page}&limit=${limit}`);
  const [localLoans, setLocalLoans] = useState<NplRow[]>([]);

  useEffect(() => {
    if (nplResponse?.data) {
      setLocalLoans(nplResponse.data);
    }
  }, [nplResponse]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localLoans);
  }, [filters, applyFilters, localLoans]);

  const summary = useMemo(() => {
    return nplResponse?.summary || { totalBadPrincipal: 0, totalActivePrincipal: 0, nplRatio: 0, badAccountsCount: 0 };
  }, [nplResponse]);

  const columns: TableColumn<NplRow>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nama Peminjam',
      width: proportional(2),
      renderCell: (item: NplRow) => (
        <Text type="body">{item.name}</Text>
      ),
    },
    {
      key: 'amount',
      header: 'Pokok Pinjaman',
      width: proportional(1.5),
      renderCell: (item: NplRow) => (
        <Text type="body">{formatRp(item.amount)}</Text>
      ),
    },
    {
      key: 'paidAmount',
      header: 'Jumlah Terbayar',
      width: proportional(1.5),
      renderCell: (item: NplRow) => (
        <Text type="body" style={{ color: '#10b981' }}>{formatRp(item.paidAmount)}</Text>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Sisa Tunggakan',
      width: proportional(1.8),
      renderCell: (item: NplRow) => (
        <Text type="body" style={{ fontWeight: 500, color: '#ef4444' }}>
          {formatRp(item.remainingAmount)}
        </Text>
      ),
    },
    {
      key: 'tenor',
      header: 'Tenor',
      width: proportional(1.2),
      renderCell: (item: NplRow) => (
        <Text type="body">{item.tenor} Bulan</Text>
      ),
    },
    {
      key: 'purpose',
      header: 'Tujuan Pinjaman',
      width: proportional(2),
      renderCell: (item: NplRow) => (
        <Text type="body">{item.purpose}</Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: proportional(1.2),
      renderCell: () => (
        <Badge variant="error" label="Macet" />
      ),
    },
  ], []);

  // Determine NPL badge/label color depending on risk level
  const nplColor = summary.nplRatio > 5 ? '#ef4444' : summary.nplRatio > 2 ? '#f59e0b' : '#10b981';

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Analisis Kredit Macet / NPL</Heading>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchNpl} errorTitle="Gagal Memuat Analisis NPL">
            <VStack gap={4}>
              <Grid columns={{minWidth: 240, repeat: 'fit'}} gap={4}>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Rasio NPL Koperasi</Text>
                    <Heading level={2} style={{ color: nplColor }}>{summary.nplRatio.toFixed(2)}%</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Total Kredit Macet</Text>
                    <Heading level={2} style={{ color: '#ef4444' }}>{formatRp(summary.totalBadPrincipal)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Kredit Aktif Sehat</Text>
                    <Heading level={2} style={{ color: '#10b981' }}>{formatRp(summary.totalActivePrincipal)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Jumlah Akun Macet</Text>
                    <Heading level={2}>{summary.badAccountsCount} Rekening</Heading>
                  </VStack>
                </Card>
              </Grid>

              <PowerSearch
                config={config}
                filters={filters}
                onChange={newFilters => {
                  setFilters([...newFilters]);
                }}
                placeholder="Cari anggota bermasalah..."
                resultCount={filtered.length}
              />
              <Table<NplRow>
                data={filtered}
                columns={columns}
                idKey="id"
                density="balanced"
                dividers="rows"
                hasHover
              />
              <Pagination
                page={nplResponse?.page || 1}
                limit={nplResponse?.limit || limit}
                total={nplResponse?.total || 0}
                onPageChange={setPage}
              />
            </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
  );
}
