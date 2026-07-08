import { useState, useMemo } from 'react';
import { Layout, LayoutContent, VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Center } from '@astryxdesign/core/Center';
import { useApiQuery } from '../hooks/useApiQuery';
import { DataStateView } from '../components/DataStateView';
import { formatRp } from '../utils/format';
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

const COLORS = ['#0171E3', '#EB6E00', '#0B991F', '#6B1EFD', '#E30171'];

export default function SHU() {
  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);
  
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

  const columns: TableColumn<any>[] = [
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
  ];

  return (
    <Layout>
      <LayoutContent padding={6}>
        <VStack gap={6}>
          <HStack justify="space-between" vAlign="center">
            <Heading level={2}>Kalkulasi Sisa Hasil Usaha (SHU)</Heading>
            <HStack gap={3} vAlign="center">
              <Text type="supporting">Tahun:</Text>
              <select 
                value={year}
                aria-label="Pilih tahun" 
                onChange={(e) => setYear(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc' }}
              >
                <option value={(Number(currentYear) - 2).toString()}>{Number(currentYear) - 2}</option>
                <option value={(Number(currentYear) - 1).toString()}>{Number(currentYear) - 1}</option>
                <option value={currentYear}>{currentYear}</option>
              </select>
            </HStack>
          </HStack>

          <DataStateView isLoading={isLoading} error={error} onRetry={refetch} errorTitle="Gagal Memuat Data SHU">
            {data && (
            <VStack gap={8}>
              {/* Ringkasan */}
              <HStack gap={4}>
                <VStack gap={1} style={{ flex: 1, padding: 20, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <Text type="supporting" color="secondary">Total Pendapatan (Bunga dsb.)</Text>
                  <Heading level={3} color="success">{formatRp(data.pendapatan)}</Heading>
                </VStack>
                <VStack gap={1} style={{ flex: 1, padding: 20, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <Text type="supporting" color="secondary">Biaya Operasional</Text>
                  <Heading level={3} color="error">{formatRp(data.biayaOperasional)}</Heading>
                </VStack>
                <VStack gap={1} style={{ flex: 1, padding: 20, backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <Text type="supporting" color="primary">SHU Netto</Text>
                  <Heading level={3} color="primary">{formatRp(data.shuNetto)}</Heading>
                </VStack>
              </HStack>

              <HStack gap={8} vAlign="start">
                <VStack gap={4} style={{ flex: 1 }}>
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
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatRp(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </VStack>
                
                <VStack gap={4} style={{ flex: 1 }}>
                  <Heading level={4}>Rincian Distribusi</Heading>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Alokasi Anggota (40%)</Text>
                      <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.anggota)}</Text>
                    </div>
                    <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Dana Cadangan (25%)</Text>
                      <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.cadangan)}</Text>
                    </div>
                    <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Jasa Pengurus (20%)</Text>
                      <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.pengurus)}</Text>
                    </div>
                    <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Dana Sosial (10%)</Text>
                      <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.sosial)}</Text>
                    </div>
                    <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Dana Pembangunan (5%)</Text>
                      <Text style={{ fontWeight: 600 }}>{formatRp(data.distribusi.pembangunan)}</Text>
                    </div>
                  </div>
                </VStack>
              </HStack>

              <VStack gap={4}>
                <HStack justify="space-between" vAlign="center">
                  <Heading level={4}>Alokasi per Anggota</Heading>
                  <Button label="Ekspor PDF" variant="secondary" />
                </HStack>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <Table
                    data={data.alokasiAnggota}
                    columns={columns}
                    idKey="id"
                    density="balanced"
                    dividers="rows"
                  />
                </div>
              </VStack>

            </VStack>
            )}
          </DataStateView>
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
