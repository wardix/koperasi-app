// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {useEffect, useState} from 'react';
import {apiUrl} from './config';
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

interface DashboardData {
  activeMembers: string;
  totalSavings: string;
  totalLoans: string;
  roleData: Array<{label: string; value: number; color: string}>;
  purposeData: Array<{label: string; value: number; color: string}>;
  monthlyData: Array<{label: string; simpanan: number; pinjaman: number}>;
  recentActivities: Array<{id: string; activity: string; name: string; amount: number; date: string}>;
}

const defaultMetrics = [
  {
    label: 'Total Anggota Aktif',
    value: '...',
    change: '+15.2%',
    positive: true,
  },
  {
    label: 'Total Simpanan',
    value: '...',
    change: '+12.5%',
    positive: true,
  },
  {
    label: 'Pinjaman Berjalan',
    value: '...',
    change: '-2.3%',
    positive: true,
  },
  {
    label: 'Kredit Macet (NPL)',
    value: '1.2%',
    change: '-0.4%',
    positive: true,
  },
];

const sparklines = [
  [48, 46, 44, 42, 40, 18, 16, 38, 36, 34, 32, 30, 12, 10, 28, 26, 28, 32, 36, 14, 12, 40, 44, 48, 52, 56, 28, 24, 58, 62],
  [36, 38, 35, 37, 36, 14, 12, 38, 36, 34, 37, 35, 12, 10, 36, 34, 36, 35, 38, 14, 12, 40, 44, 50, 54, 56, 26, 22, 58, 60],
  [58, 56, 60, 58, 62, 30, 26, 60, 58, 62, 60, 58, 28, 24, 56, 54, 50, 46, 42, 18, 14, 38, 36, 34, 32, 30, 10, 8, 28, 26],
  [52, 56, 50, 54, 58, 62, 60, 54, 52, 56, 50, 54, 60, 58, 50, 48, 46, 44, 40, 46, 44, 38, 36, 34, 36, 32, 38, 36, 30, 28],
];

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
            name="Total Simpanan"
            stroke={chartColors.simpanan}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="pinjaman"
            name="Total Pinjaman"
            stroke={chartColors.pinjaman}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <HStack gap={6} vAlign="center">
        <ChartLegendItem color={chartColors.simpanan} label="Simpanan" />
        <ChartLegendItem color={chartColors.pinjaman} label="Pinjaman" />
      </HStack>
    </VStack>
  );
}

function Sparkline({data}: {data: number[]}) {
  const chartData = data.map((v, i) => ({i, v}));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
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

function MetricCard({
  label,
  value,
  change,
  positive,
  sparkline,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  sparkline: number[];
}) {
  return (
    <Card>
      <VStack gap={2}>
        <Heading level={4}>{label}</Heading>
        <HStack gap={2} vAlign="center">
          <Heading level={2}>{value}</Heading>
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
        </HStack>
        <Text type="supporting" color="secondary">
          Bulan Terakhir vs Sebelumnya
        </Text>
        <Sparkline data={sparkline} />
      </VStack>
    </Card>
  );
}

function StackedBarCard({
  title,
  data,
}: {
  title: string;
  data: Array<{label: string; value: number; color: string}>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = [Object.fromEntries(data.map(d => [d.label, d.value]))];

  return (
    <Card>
      <VStack gap={4}>
        <Heading level={4}>{title}</Heading>
        {data.length === 0 ? <Text>Belum ada data</Text> : (
          <>
            <ResponsiveContainer width="100%" height={24}>
              <BarChart
                data={chartData}
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
}

// ============= TABLE COMPONENTS =============

function RecentActivitiesTable({ data }: { data: DashboardData['recentActivities'] }) {
  const columns: TableColumn<DashboardData['recentActivities'][0]>[] = [
    {key: 'activity', header: 'Aktivitas', width: pixel(160)},
    {key: 'name', header: 'Nama / Subjek', width: proportional(1)},
    {
      key: 'amount', 
      header: 'Nilai', 
      width: pixel(150),
      renderCell: (item) => 'Rp ' + item.amount.toLocaleString('id-ID')
    },
    {key: 'date', header: 'Tanggal', width: pixel(120)},
  ];

  return (
    <Card>
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
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const fetchStats = () => {
    fetch(apiUrl('/api/stats'))
      .then(res => res.json())
      .then((data: DashboardData) => {
        setDashboardData(data);
        setMetrics([
          { ...defaultMetrics[0], value: data.activeMembers },
          { ...defaultMetrics[1], value: data.totalSavings },
          { ...defaultMetrics[2], value: data.totalLoans },
          defaultMetrics[3] // NPL remains static
        ]);
      })
      .catch(err => console.error("Error fetching stats:", err));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Layout
      height="auto"
      content={
        <LayoutContent padding={6}>
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
              {dashboardData?.monthlyData && <MonthlyChart data={dashboardData.monthlyData} />}
            </VStack>

            {/* Metric Cards */}
            <Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}>
              {[0, 2].map(start => (
                <Grid
                  key={start}
                  columns={{minWidth: 240, repeat: 'fit'}}
                  gap={4}>
                  {metrics.slice(start, start + 2).map((m, i) => (
                    <MetricCard
                      key={m.label}
                      {...m}
                      sparkline={sparklines[start + i]}
                    />
                  ))}
                </Grid>
              ))}
            </Grid>

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
              <RecentActivitiesTable data={dashboardData?.recentActivities || []} />
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
