import { useState, useMemo } from 'react';
import { Layout, LayoutHeader, LayoutContent, VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../hooks/useAuth';
import { DataStateView } from '../components/DataStateView';
import { formatRp } from '../utils/format';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { getCategoricalColor, getThemedTooltipProps } from '../design/chartTheme';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ShuConfigDialog } from '../components/ShuConfigDialog';
import type { ShuConfig } from '../shared/types';

interface SHUData {
  year: string;
  isClosed?: boolean;
  mode?: 'realization' | 'projection';
  pendapatan: number;
  realizedPendapatan?: number;
  projectedPendapatan?: number;
  biayaOperasional: number;
  shuNetto: number;
  distribusi: {
    anggota: number;
    cadangan: number;
    pengurus: number;
    sosial: number;
    pembangunan: number;
  };
  alokasiAnggota: {
    id: string;
    name: string;
    status?: string;
    totalSavings: number;
    averageSavings?: number;
    savingsShare?: number;
    loansShare?: number;
    shu: number;
  }[];
  config?: ShuConfig;
}

export default function SHU() {
  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState<'realization' | 'projection'>('realization');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const { hasPermission } = useAuth();
  
  const { data, isLoading, error, refetch } = useApiQuery<SHUData>(`/api/shu?year=${year}&mode=${mode}`);

  const distributionItems = useMemo(() => {
    if (!data) return [];
    const cfg = data.config || {
      anggotaPct: 40,
      cadanganPct: 25,
      pengurusPct: 20,
      sosialPct: 10,
      pembangunanPct: 5,
    };

    const all = [
      { key: 'anggota', label: 'Alokasi Anggota', pct: cfg.anggotaPct, value: data.distribusi.anggota },
      { key: 'cadangan', label: 'Dana Cadangan', pct: cfg.cadanganPct, value: data.distribusi.cadangan },
      { key: 'pengurus', label: 'Jasa Pengurus & Pengawas', pct: cfg.pengurusPct, value: data.distribusi.pengurus },
      { key: 'sosial', label: 'Dana Sosial', pct: cfg.sosialPct, value: data.distribusi.sosial },
      { key: 'pembangunan', label: 'Dana Pembangunan Kerja', pct: cfg.pembangunanPct, value: data.distribusi.pembangunan },
    ];

    return all.filter((item) => item.pct > 0);
  }, [data]);

  const chartData = useMemo(() => {
    return distributionItems.map((item) => ({
      name: `${item.label} (${item.pct}%)`,
      value: item.value,
    }));
  }, [distributionItems]);

  const isProjection = data?.mode === 'projection' && !data?.isClosed;
  const hasPinjamanShare = Number(data?.config?.jasaPinjamanPct ?? 50) > 0;
  const hasSimpananShare = Number(data?.config?.jasaSimpananPct ?? 50) > 0;

  const columns: TableColumn<SHUData['alokasiAnggota'][0]>[] = useMemo(() => {
    const cols: TableColumn<SHUData['alokasiAnggota'][0]>[] = [
      {
        key: 'name',
        header: 'Nama Anggota',
        width: proportional(2),
        renderCell: (item) => (
          <HStack gap={2} vAlign="center">
            <Text type="body">{item.name}</Text>
            {item.status && item.status.toLowerCase() !== 'aktif' && (
              <Badge variant="neutral" label={item.status} size="sm" />
            )}
          </HStack>
        ),
      },
      {
        key: 'averageSavings',
        header: 'Saldo Rata-Rata (ADB)',
        width: proportional(1.5),
        renderCell: (item) => (
          <VStack gap={0}>
            <Text type="body">{formatRp(item.averageSavings ?? item.totalSavings)}</Text>
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              Saldo Akhir: {formatRp(item.totalSavings)}
            </Text>
          </VStack>
        ),
      },
    ];

    if (hasSimpananShare) {
      cols.push({
        key: 'savingsShare',
        header: 'Jasa Simpanan',
        width: proportional(1),
        renderCell: (item) => (
          <Text type="body">{formatRp(item.savingsShare ?? 0)}</Text>
        ),
      });
    }

    if (hasPinjamanShare) {
      cols.push({
        key: 'loansShare',
        header: 'Jasa Pinjaman',
        width: proportional(1),
        renderCell: (item) => (
          <Text type="body">{formatRp(item.loansShare ?? 0)}</Text>
        ),
      });
    }

    cols.push({
      key: 'shu',
      header: isProjection ? 'Estimasi SHU Akhir Tahun' : 'Alokasi SHU',
      width: proportional(1.2),
      renderCell: (item) => <Text type="body" color="success">+{formatRp(item.shu)}</Text>,
    });

    return cols;
  }, [isProjection, hasSimpananShare, hasPinjamanShare]);

  const exportCols = useMemo(() => {
    const cols = [
      { header: 'Nama Anggota', key: 'name' },
      { header: 'Status', key: 'status', render: (item: any) => item.status || 'Aktif' },
      { header: 'Saldo Rata-Rata (ADB)', key: 'averageSavings', render: (item: any) => formatRp(item.averageSavings ?? item.totalSavings) },
      { header: 'Saldo Akhir Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) },
    ];

    if (hasSimpananShare) {
      cols.push({
        header: 'Jasa Simpanan',
        key: 'savingsShare',
        render: (item: any) => formatRp(item.savingsShare ?? 0),
      });
    }

    if (hasPinjamanShare) {
      cols.push({
        header: 'Jasa Pinjaman',
        key: 'loansShare',
        render: (item: any) => formatRp(item.loansShare ?? 0),
      });
    }

    cols.push({
      header: isProjection ? 'Estimasi SHU Akhir Tahun' : 'Alokasi SHU',
      key: 'shu',
      render: (item: any) => formatRp(item.shu),
    });

    return cols;
  }, [hasSimpananShare, hasPinjamanShare, isProjection]);

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="space-between" vAlign="center" style={{ width: '100%' }}>
            <StackItem>
              <HStack gap={3} vAlign="center">
                <Heading level={2}>Kalkulasi Sisa Hasil Usaha (SHU)</Heading>
                {data?.isClosed ? (
                  <Badge variant="neutral" label="Tutup Buku Final" />
                ) : isProjection ? (
                  <Badge variant="info" label="Mode Proyeksi" />
                ) : null}
              </HStack>
            </StackItem>
            <StackItem>
              <HStack gap={3} vAlign="center">
                {!data?.isClosed && (
                  <div
                    style={{
                      display: 'inline-flex',
                      backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
                      padding: 3,
                      borderRadius: 8,
                      gap: 2,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMode('realization')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: mode === 'realization' ? 600 : 500,
                        fontSize: 13,
                        backgroundColor: mode === 'realization' ? 'var(--color-background-primary, #ffffff)' : 'transparent',
                        color: mode === 'realization' ? 'var(--color-text-primary, #111827)' : 'var(--color-text-secondary, #6b7280)',
                        boxShadow: mode === 'realization' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Realisasi (YTD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('projection')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: mode === 'projection' ? 600 : 500,
                        fontSize: 13,
                        backgroundColor: mode === 'projection' ? 'var(--color-background-primary, #ffffff)' : 'transparent',
                        color: mode === 'projection' ? 'var(--color-text-primary, #111827)' : 'var(--color-text-secondary, #6b7280)',
                        boxShadow: mode === 'projection' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Proyeksi Akhir Tahun
                    </button>
                  </div>
                )}
                {hasPermission('update:settings') && (
                  <Button
                    label="Atur Alokasi AD/ART"
                    variant="secondary"
                    onClick={() => setShowConfigModal(true)}
                  />
                )}
                <Text type="supporting">Tahun Buku:</Text>
                <select 
                  value={year}
                  aria-label="Pilih tahun" 
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-background-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value={(Number(currentYear) - 2).toString()}>{Number(currentYear) - 2}</option>
                  <option value={(Number(currentYear) - 1).toString()}>{Number(currentYear) - 1}</option>
                  <option value={currentYear}>{currentYear}</option>
                </select>
              </HStack>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        <DataStateView isLoading={isLoading} error={error} onRetry={refetch} errorTitle="Gagal Memuat Data SHU">
          {data && (
            <VStack gap={6}>
              {/* Alert Mode Proyeksi */}
              {isProjection && (
                <Card style={{ padding: '12px 16px', backgroundColor: 'var(--color-background-info-subtle, #eff6ff)', border: '1px solid var(--color-border-info, #bfdbfe)' }}>
                  <HStack gap={2} vAlign="center">
                    <Badge variant="info" label="Simulasi Prognosis RAT" />
                    <Text type="supporting" style={{ color: 'var(--color-text-info, #1e40af)' }}>
                      Menghitung realisasi bunga pinjaman berjalan (YTD) ditambah estimasi bunga jadwal pinjaman aktif yang jatuh tempo hingga akhir tahun {year}. Angka ini bersifat indikatif (simulasi) dan bukan pembagian kas resmi.
                    </Text>
                  </HStack>
                </Card>
              )}

              {/* Ringkasan KPI Cards */}
              <HStack gap={4} wrap="wrap">
                <Card style={{ flex: '1 1 200px', padding: 20 }}>
                  <VStack gap={1}>
                    <HStack justify="space-between" vAlign="center">
                      <Text type="supporting" color="secondary">
                        {isProjection ? 'Proyeksi Pendapatan' : 'Total Pendapatan (Bunga dsb.)'}
                      </Text>
                      {isProjection && (
                        <Badge variant="info" size="sm" label="Proyeksi" />
                      )}
                    </HStack>
                    <Heading level={3} color="success">{formatRp(data.pendapatan)}</Heading>
                    {isProjection && data.projectedPendapatan !== undefined && data.projectedPendapatan > 0 && (
                      <Text type="caption" color="secondary">
                        Realisasi: {formatRp(data.realizedPendapatan ?? 0)} + Proyeksi: {formatRp(data.projectedPendapatan)}
                      </Text>
                    )}
                  </VStack>
                </Card>
                <Card style={{ flex: '1 1 200px', padding: 20 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Biaya Operasional</Text>
                    <Heading level={3} color="error">{formatRp(data.biayaOperasional)}</Heading>
                    <Text type="caption" color="secondary">Realisasi Beban Akuntansi</Text>
                  </VStack>
                </Card>
                <Card style={{ flex: '1 1 200px', padding: 20, backgroundColor: 'var(--color-background-primary-subtle)' }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="primary">
                      {isProjection ? 'Estimasi SHU Netto' : 'SHU Netto'}
                    </Text>
                    <Heading level={3} color="primary">{formatRp(data.shuNetto)}</Heading>
                    {isProjection && (
                      <Text type="caption" color="primary">Potensi Hasil Akhir Tahun</Text>
                    )}
                  </VStack>
                </Card>
              </HStack>

              {/* Chart & Distribusi */}
              <HStack gap={6} vAlign="start" wrap="wrap">
                <Card style={{ flex: '1 1 340px', padding: 20 }}>
                  <VStack gap={4}>
                    <Heading level={4}>Distribusi SHU</Heading>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart accessibilityLayer>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getCategoricalColor(index)} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatRp(value)} {...getThemedTooltipProps()} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </VStack>
                </Card>
                
                <Card style={{ flex: '1 1 340px', padding: 20 }}>
                  <VStack gap={4}>
                    <Heading level={4}>Rincian Distribusi</Heading>
                    <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden' }}>
                      {distributionItems.length > 0 ? (
                        distributionItems.map((item, index) => (
                          <div
                            key={item.key}
                            style={{
                              padding: 12,
                              borderBottom: index < distributionItems.length - 1 ? '1px solid var(--color-border-primary)' : 'none',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text>{item.label} ({item.pct}%)</Text>
                            <Text style={{ fontWeight: 600 }}>{formatRp(item.value)}</Text>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: 16, textAlign: 'center' }}>
                          <Text type="supporting" color="secondary">Tidak ada alokasi aktif</Text>
                        </div>
                      )}
                    </div>
                  </VStack>
                </Card>
              </HStack>

              {/* Table Alokasi Anggota */}
              <VStack gap={4}>
                <HStack justify="space-between" vAlign="center">
                  <Heading level={4}>Alokasi per Anggota</Heading>
                  {hasPermission('export:reports') && (
                    <HStack gap={2}>
                      <Button label="Ekspor Excel" variant="ghost" onClick={() => {
                        if (!data || data.alokasiAnggota.length === 0) return;
                        exportToExcel(data.alokasiAnggota, exportCols, isProjection ? `Proyeksi_SHU_${year}` : `Alokasi_SHU_${year}`);
                      }} />
                      <Button label="Ekspor PDF" variant="secondary" onClick={() => {
                        if (!data || data.alokasiAnggota.length === 0) return;
                        const title = isProjection ? `PROYEKSI SISA HASIL USAHA (SHU) TAHUN ${year}` : `ALOKASI SISA HASIL USAHA (SHU) TAHUN ${year}`;
                        exportToPDF(data.alokasiAnggota, exportCols, isProjection ? `Proyeksi_SHU_${year}` : `Laporan_SHU_${year}`, title);
                      }} />
                    </HStack>
                  )}
                </HStack>
                <Card style={{ overflow: 'hidden' }}>
                  <Table
                    data={data.alokasiAnggota}
                    columns={columns}
                    idKey="id"
                    density="balanced"
                    dividers="rows"
                  />
                </Card>
              </VStack>
            </VStack>
          )}
        </DataStateView>
      </LayoutContent>

      {showConfigModal && (
        <ShuConfigDialog
          currentConfig={data?.config}
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </Layout>
  );
}
