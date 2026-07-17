// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {
  VStack,
  HStack,
  Layout,
  LayoutContent,

} from '@astryxdesign/core/Layout';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon} from '@heroicons/react/24/outline';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import React, {useState, useEffect} from 'react';
import {useApiQuery} from './hooks/useApiQuery';
import {DataStateView} from './components/DataStateView';
import {formatRp, formatDate} from './utils/format';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {Grid} from '@astryxdesign/core/Grid';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Divider} from '@astryxdesign/core/Divider';
import {Icon} from '@astryxdesign/core/Icon';

// ============= ICONS =============

import {
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import {StopIcon} from '@heroicons/react/24/solid';

// ============= DATA & INTERFACES =============

import type {DashboardData} from '../shared/types';

// ============= CHART COMPONENTS =============

const chartColors = {
  simpanan: 'var(--color-data-categorical-blue, #0171E3)',
  pinjaman: 'var(--color-data-categorical-orange, #EB6E00)',
};

function ChartLegendItem({color, label}: {color: string; label: string}) {
  return (
    <HStack gap={2} vAlign="center">
      <Icon icon={StopIcon} size="xsm" style={{color}} />
      <Text type="supporting" color="secondary">
        {label}
      </Text>
    </HStack>
  );
}

function MonthlyChart({ data }: { data: DashboardData['monthlyData'] }) {
  return (
    <VStack gap={3}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          accessibilityLayer
          margin={{top: 5, right: 10, left: 0, bottom: 5}}>
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--color-border, rgba(5, 54, 89, 0.1))"
          />
          <XAxis
            dataKey="label"
            tick={{
              fontSize: 'var(--font-size-sm, 12px)',
              fill: 'var(--color-text-secondary, #4E606F)',
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => 'Rp ' + (v / 1000000).toFixed(0) + 'M'}
            tick={{
              fontSize: 'var(--font-size-sm, 12px)',
              fill: 'var(--color-text-secondary, #4E606F)',
            }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value: number) => ['Rp ' + (value/1000000).toFixed(1) + ' Juta', '']}
            cursor={{stroke: 'var(--color-border, rgba(5, 54, 89, 0.1))'}}
          />
          <Line
            type="monotone"
            dataKey="simpanan"
            name="Saldo Simpanan"
            stroke={chartColors.simpanan}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="pinjaman"
            name="Sisa Pinjaman"
            stroke={chartColors.pinjaman}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <HStack gap={6} vAlign="center">
        <ChartLegendItem color={chartColors.simpanan} label="Saldo Simpanan" />
        <ChartLegendItem color={chartColors.pinjaman} label="Sisa Pinjaman" />
      </HStack>
    </VStack>
  );
}

function Sparkline({data}: {data: number[]}) {
  const chartData = data.map((v, i) => ({i, v}));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData} accessibilityLayer>
        <Line
          type="linear"
          dataKey="v"
          stroke="var(--color-data-categorical-blue, #0171E3)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============= CARD COMPONENTS =============

const MetricCard = React.memo(function MetricCard({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}) {
  return (
    <Card className="hover-card">
      <VStack gap={2}>
        <Heading level={4}>{label}</Heading>
        <HStack gap={2} vAlign="center">
          <Heading level={2}>{value}</Heading>
          {change && positive !== undefined && (
            <HStack gap={1} vAlign="center">
              {positive ? (
                <Icon icon={ArrowUpIcon} size="xsm" color="success" />
              ) : (
                <Icon icon={ArrowDownIcon} size="xsm" color="error" />
              )}
              <Text type="body" color="secondary">
                {change}
              </Text>
            </HStack>
          )}
        </HStack>
        {change && (
          <Text type="supporting" color="secondary">
            Bulan Terakhir vs Sebelumnya
          </Text>
        )}
      </VStack>
    </Card>
  );
});

const StackedBarCard = React.memo(function StackedBarCard({
  title,
  data,
}: {
  title: string;
  data: Array<{label: string; value: number; color: string}>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = [Object.fromEntries(data.map(d => [d.label, d.value]))];

  return (
    <Card className="hover-card">
      <VStack gap={4}>
        <Heading level={4}>{title}</Heading>
        {data.length === 0 ? <Text>Belum ada data</Text> : (
          <>
            <ResponsiveContainer width="100%" height={24}>
              <BarChart
                data={chartData}
                accessibilityLayer
                layout="vertical"
                margin={{top: 0, right: 0, bottom: 0, left: 0}}
                barCategoryGap={0}>
                <XAxis type="number" hide />
                <YAxis type="category" hide />
                {data.map((d, i) => (
                  <Bar
                    key={d.label}
                    dataKey={d.label}
                    stackId="stack"
                    fill={d.color}
                    isAnimationActive={false}
                    radius={
                      i === 0
                        ? [4, 0, 0, 4]
                        : i === data.length - 1
                          ? [0, 4, 4, 0]
                          : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <HStack gap={4} wrap="wrap">
              {data.map(d => (
                <VStack key={d.label} gap={0}>
                  <HStack gap={2} vAlign="center">
                    <Icon icon={StopIcon} size="xsm" style={{color: d.color}} />
                    <Text type="supporting">{d.label}</Text>
                  </HStack>
                  <Text type="supporting" color="secondary">
                    {d.value} - {((d.value / total) * 100).toFixed(2)}%
                  </Text>
                </VStack>
              ))}
            </HStack>
          </>
        )}
      </VStack>
    </Card>
  );
});

// ============= TABLE COMPONENTS =============

function RecentActivitiesTable({ data }: { data: DashboardData['recentActivities'] }) {
  const columns: TableColumn<DashboardData['recentActivities'][0]>[] = React.useMemo(() => [
    {key: 'activity', header: 'Aktivitas', width: pixel(160)},
    {key: 'name', header: 'Nama / Subjek', width: proportional(1)},
    {
      key: 'amount', 
      header: 'Nilai', 
      width: pixel(150),
      renderCell: (item) => formatRp(item.amount)
    },
    {
      key: 'date', 
      header: 'Tanggal', 
      width: pixel(120),
      renderCell: (item) => formatDate(item.date)
    },
  ], []);

  return (
    <Card className="hover-card">
      <VStack gap={6}>
        <HStack hAlign="between" vAlign="center">
          <Heading level={4}>Aktivitas Terbaru</Heading>
        </HStack>
        <Table
          data={data}
          columns={columns}
          idKey="id"
          density="compact"
          dividers="rows"
          hasHover
        />
      </VStack>
    </Card>
  );
}

// ============= MAIN COMPONENT =============

export default function DashboardTemplate() {
  const [metrics, setMetrics] = useState<Array<{label: string; value: string}>>([]);
  const { data: dashboardData, isLoading, error, refetch: fetchStats } = useApiQuery<DashboardData>('/api/stats');

  useEffect(() => {
    if (dashboardData) {
      const formatCompactRp = (val: number) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(val);
      
      setMetrics([
        { label: 'Total Anggota Aktif', value: String(dashboardData.activeMembers) },
        { label: 'Total Simpanan', value: formatCompactRp(dashboardData.totalSavings) },
        { label: 'Pinjaman Berjalan', value: formatCompactRp(dashboardData.totalLoans) },
        { label: 'Kredit Macet (NPL)', value: String(dashboardData.npl) },
      ]);
    } else {
      setMetrics([]);
    }
  }, [dashboardData]);

  return (
    <Layout
      height="auto"
      content={
        <LayoutContent padding={6}>
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchStats} errorTitle="Gagal Memuat Dasbor">
          <VStack gap={6}>
            {/* Trend Chart */}
            <VStack gap={6}>
              <HStack hAlign="between" vAlign="center">
                <Heading level={3}>Tren Pertumbuhan Koperasi</Heading>
                <Button
                  label="Muat Ulang"
                  variant="secondary"
                  size="md"
                  icon={<Icon icon={ArrowPathIcon} size="sm" />}
                  onClick={fetchStats}
                />
              </HStack>
              {dashboardData?.monthlyData && dashboardData.monthlyData.length > 0 ? (
                <MonthlyChart data={dashboardData.monthlyData} />
              ) : (
                <Text type="supporting" color="secondary">Belum ada data tren</Text>
              )}
            </VStack>

            {/* Metric Cards */}
            {metrics.length > 0 ? (
              <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
                {[0, 2].map(start => (
                  <Grid
                    key={start}
                    columns={{minWidth: 240, repeat: 'fit'}}
                    gap={4}>
                    {metrics.slice(start, start + 2).map(m => (
                      <MetricCard key={m.label} {...m} />
                    ))}
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Text type="supporting" color="secondary">Memuat metrik...</Text>
            )}

            <Divider />

            {/* Demographics & Distribution */}
            <HStack hAlign="between" vAlign="center">
              <Heading level={3}>Distribusi Portofolio</Heading>
            </HStack>
            <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
              <StackedBarCard title="Peran Anggota" data={dashboardData?.roleData || []} />
              <StackedBarCard title="Tujuan Pinjaman" data={dashboardData?.purposeData || []} />
            </Grid>

            <Divider />

            {/* Recent Activities */}
            <VStack gap={4}>
              {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
                <RecentActivitiesTable data={dashboardData.recentActivities} />
              ) : (
                <Text type="supporting" color="secondary">Belum ada aktivitas</Text>
              )}
            </VStack>
          </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
  );
}
