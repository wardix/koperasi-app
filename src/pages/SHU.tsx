import { useState, useMemo } from 'react';
import { Layout, LayoutHeader, LayoutContent, VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../hooks/useAuth';
import { DataStateView } from '../components/DataStateView';
import { formatRp } from '../utils/format';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { getCategoricalColor, getThemedTooltipProps } from '../design/chartTheme';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SHUData {
  year: string;
  pendapatan: number;
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
    totalSavings: number;
    shu: number;
  }[];
}

export default function SHU() {
  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  const { hasPermission } = useAuth();
  
  const { data, isLoading, error, refetch } = useApiQuery<SHUData>(`/api/shu?year=${year}`);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Anggota (40%)', value: data.distribusi.anggota },
      { name: 'Cadangan (25%)', value: data.distribusi.cadangan },
      { name: 'Pengurus (20%)', value: data.distribusi.pengurus },
      { name: 'Sosial (10%)', value: data.distribusi.sosial },
      { name: 'Pembangunan (5%)', value: data.distribusi.pembangunan },
    ];
  }, [data]);

  const columns: TableColumn<SHUData['alokasiAnggota'][0]>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item) => <Text type="body">{item.name}</Text>,
    },
    {
      key: 'totalSavings',
      header: 'Total Simpanan',
      width: proportional(1),
      renderCell: (item) => <Text type="body">{formatRp(item.totalSavings)}</Text>,
    },
    {
      key: 'shu',
      header: 'Alokasi SHU',
      width: proportional(1),
      renderCell: (item) => <Text type="body" color="success">+{formatRp(item.shu)}</Text>,
    },
  ], []);

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="space-between" vAlign="center" style={{ width: '100%' }}>
            <StackItem>
              <Heading level={2}>Kalkulasi Sisa Hasil Usaha (SHU)</Heading>
            </StackItem>
            <StackItem>
              <HStack gap={3} vAlign="center">
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
              {/* Ringkasan KPI Cards */}
              <HStack gap={4} wrap="wrap">
                <Card style={{ flex: '1 1 200px', padding: 20 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Total Pendapatan (Bunga dsb.)</Text>
                    <Heading level={3} color="success">{formatRp(data.pendapatan)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ flex: '1 1 200px', padding: 20 }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">Biaya Operasional</Text>
                    <Heading level={3} color="error">{formatRp(data.biayaOperasional)}</Heading>
                  </VStack>
                </Card>
                <Card style={{ flex: '1 1 200px', padding: 20, backgroundColor: 'var(--color-background-primary-subtle)' }}>
                  <VStack gap={1}>
                    <Text type="supporting" color="primary">SHU Netto</Text>
                    <Heading level={3} color="primary">{formatRp(data.shuNetto)}</Heading>
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
                      <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Alokasi Anggota (40%)</Text>
                        <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.anggota)}</Text>
                      </div>
                      <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Dana Cadangan (25%)</Text>
                        <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.cadangan)}</Text>
                      </div>
                      <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Jasa Pengurus (20%)</Text>
                        <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.pengurus)}</Text>
                      </div>
                      <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Dana Sosial (10%)</Text>
                        <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.sosial)}</Text>
                      </div>
                      <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Dana Pembangunan (5%)</Text>
                        <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.pembangunan)}</Text>
                      </div>
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
                        const exportCols = [
                          { header: 'Nama Anggota', key: 'name' },
                          { header: 'Total Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) },
                          { header: 'Alokasi SHU', key: 'shu', render: (item: any) => formatRp(item.shu) }
                        ];
                        exportToExcel(data.alokasiAnggota, exportCols, `Alokasi_SHU_${year}`);
                      }} />
                      <Button label="Ekspor PDF" variant="secondary" onClick={() => {
                        if (!data || data.alokasiAnggota.length === 0) return;
                        const exportCols = [
                          { header: 'Nama Anggota', key: 'name' },
                          { header: 'Total Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) },
                          { header: 'Alokasi SHU', key: 'shu', render: (item: any) => formatRp(item.shu) }
                        ];
                        exportToPDF(data.alokasiAnggota, exportCols, `Laporan_SHU_${year}`, `ALOKASI SISA HASIL USAHA (SHU) TAHUN ${year}`);
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
    </Layout>
  );
}
