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

  const [selectedTab, setSelectedTab] = useState<'ALL' | 'LANCAR' | 'DPK' | 'KURANG_LANCAR' | 'DIRAGUKAN' | 'MACET'>('ALL');

  const filtered = useMemo(() => {
    let list = applyFilters(filters, localLoans);
    if (selectedTab === 'LANCAR') {
      list = list.filter((i) => i.collectibility === 'Lancar' || (!i.dpd && i.status !== 'Macet'));
    } else if (selectedTab === 'DPK') {
      list = list.filter((i) => i.collectibility === 'Dalam Perhatian Khusus' || (i.dpd && i.dpd >= 1 && i.dpd <= 30));
    } else if (selectedTab === 'KURANG_LANCAR') {
      list = list.filter((i) => i.collectibility === 'Kurang Lancar' || (i.dpd && i.dpd >= 31 && i.dpd <= 60));
    } else if (selectedTab === 'DIRAGUKAN') {
      list = list.filter((i) => i.collectibility === 'Diragukan' || (i.dpd && i.dpd >= 61 && i.dpd <= 90));
    } else if (selectedTab === 'MACET') {
      list = list.filter((i) => i.collectibility === 'Macet' || i.status === 'Macet' || (i.dpd && i.dpd > 90));
    }
    return list;
  }, [filters, applyFilters, localLoans, selectedTab]);

  const summary = useMemo(() => {
    return nplResponse?.summary || { totalBadPrincipal: 0, totalActivePrincipal: 0, nplRatio: 0, badAccountsCount: 0 };
  }, [nplResponse]);

  const columns: TableColumn<NplRow>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nama Peminjam',
      width: proportional(2),
      renderCell: (item: NplRow) => (
        <VStack gap={0}>
          <Text type="body" weight="semibold">{item.name}</Text>
          <Text type="supporting" size="sm" color="secondary">{item.purpose}</Text>
        </VStack>
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
      header: 'Sudah Terbayar',
      width: proportional(1.5),
      renderCell: (item: NplRow) => (
        <Text type="body" style={{ color: 'var(--color-success-500)' }}>{formatRp(item.paidAmount)}</Text>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Sisa Hutang',
      width: proportional(1.6),
      renderCell: (item: NplRow) => (
        <Text type="body" style={{ fontWeight: 600, color: item.remainingAmount > 0 ? 'var(--color-critical-500)' : 'var(--color-text-primary)' }}>
          {formatRp(item.remainingAmount)}
        </Text>
      ),
    },
    {
      key: 'dpd',
      header: 'Keterlambatan (DPD)',
      width: proportional(1.5),
      renderCell: (item: NplRow) => {
        const dpd = item.dpd || 0;
        if (dpd === 0) {
          return (
            <Text type="supporting" color="success" style={{ fontWeight: 500 }}>
              0 Hari (Lancar)
            </Text>
          );
        }
        const isCritical = dpd > 90;
        const isWarning = dpd > 30;
        return (
          <Text
            type="body"
            style={{
              fontWeight: 600,
              color: isCritical ? 'var(--color-critical-500)' : isWarning ? 'var(--color-warning-600, #d97706)' : 'var(--color-text-primary)'
            }}
          >
            ⚠️ {dpd} Hari
          </Text>
        );
      },
    },
    {
      key: 'collectibility',
      header: 'Status Kolektibilitas',
      width: proportional(1.8),
      renderCell: (item: NplRow) => {
        const col = item.collectibility || (item.status === 'Macet' ? 'Macet' : item.dpd && item.dpd > 90 ? 'Macet' : 'Lancar');
        if (col === 'Macet') {
          return <Badge variant="critical" label="Macet (Kol 5)" />;
        }
        if (col === 'Diragukan') {
          return <Badge variant="critical" label="Diragukan (Kol 4)" />;
        }
        if (col === 'Kurang Lancar') {
          return <Badge variant="warning" label="Kurang Lancar (Kol 3)" />;
        }
        if (col === 'Dalam Perhatian Khusus') {
          return <Badge variant="warning" label="DPK (Kol 2)" />;
        }
        return <Badge variant="success" label="Lancar (Kol 1)" />;
      },
    },
  ], []);

  // Determine NPL badge/label color depending on risk level
  const nplColor = summary.nplRatio > 5 ? 'var(--color-critical-500)' : summary.nplRatio > 2 ? 'var(--color-warning-500)' : 'var(--color-success-500)';

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Analisis Kualitas Pinjaman &amp; NPL</Heading>
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
                    <Text type="supporting" size="sm" color="secondary">
                      Batas aman regulator: &le; 5.00%
                    </Text>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Total Kredit Macet (NPL)</Text>
                    <Heading level={2} style={{ color: 'var(--color-critical-500)' }}>{formatRp(summary.totalBadPrincipal)}</Heading>
                    <Text type="supporting" size="sm" color="secondary">
                      {summary.badAccountsCount} rekening bermasalah
                    </Text>
                  </VStack>
                </Card>
                <Card style={{ padding: '20px' }}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">Total Pinjaman Berjalan</Text>
                    <Heading level={2} style={{ color: 'var(--color-success-500)' }}>{formatRp(summary.totalActivePrincipal)}</Heading>
                    <Text type="supporting" size="sm" color="secondary">
                      Portofolio pinjaman aktif
                    </Text>
                  </VStack>
                </Card>
              </Grid>

              {/* Filter Tabs Kolektibilitas */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border-primary)', paddingBottom: '12px' }}>
                {[
                  { id: 'ALL', label: 'Semua Pinjaman' },
                  { id: 'LANCAR', label: 'Lancar (Kol 1 - 0 hr)' },
                  { id: 'DPK', label: 'Perhatian Khusus (Kol 2 - 1-30 hr)' },
                  { id: 'KURANG_LANCAR', label: 'Kurang Lancar (Kol 3 - 31-60 hr)' },
                  { id: 'DIRAGUKAN', label: 'Diragukan (Kol 4 - 61-90 hr)' },
                  { id: 'MACET', label: 'Kredit Macet (Kol 5 - >90 hr)' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id as any)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: selectedTab === tab.id ? 'var(--color-primary-500, #0171E3)' : 'var(--color-border-primary)',
                      backgroundColor: selectedTab === tab.id ? 'var(--color-primary-500, #0171E3)' : 'var(--color-background-primary)',
                      color: selectedTab === tab.id ? '#ffffff' : 'var(--color-text-primary)',
                      fontSize: '13px',
                      fontWeight: selectedTab === tab.id ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <PowerSearch
                config={config}
                filters={filters}
                onChange={newFilters => {
                  setFilters([...newFilters]);
                }}
                placeholder="Cari nama peminjam atau keperluan pinjaman..."
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
