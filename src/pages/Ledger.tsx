'use client';

import React from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import { DataStateView } from '../components/DataStateView';

type LedgerRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export default function Ledger() {
  const {
    data: ledgerRes,
    isLoading,
    error,
    refetch,
  } = useApiQuery<{ data: LedgerRow[] }>('/api/accounting/ledger');

  const rows = ledgerRes?.data || [];

  const columns: TableColumn<LedgerRow>[] = [
    {
      id: 'code',
      header: 'Kode Akun',
      accessor: (r) => r.code,
      width: proportional(15),
      cell: (v) => <Text style={{ fontWeight: 600 }}>{v as string}</Text>
    },
    {
      id: 'name',
      header: 'Nama Akun',
      accessor: (r) => r.name,
      width: proportional(30),
      cell: (v, r) => (
        <VStack gap={1}>
          <Text>{v as string}</Text>
          <Text type="supporting" color="secondary">{r.type}</Text>
        </VStack>
      )
    },
    {
      id: 'total_debit',
      header: 'Total Debit',
      accessor: (r) => r.total_debit,
      width: proportional(15),
      cell: (v) => <Text style={{ textAlign: 'right' }}>{formatRp(Number(v))}</Text>
    },
    {
      id: 'total_credit',
      header: 'Total Kredit',
      accessor: (r) => r.total_credit,
      width: proportional(15),
      cell: (v) => <Text style={{ textAlign: 'right' }}>{formatRp(Number(v))}</Text>
    },
    {
      id: 'balance',
      header: 'Saldo Akhir',
      accessor: (r) => r.balance,
      width: proportional(25),
      cell: (v) => (
        <Text style={{ textAlign: 'right', fontWeight: 600 }}>
          {formatRp(Number(v))}
        </Text>
      )
    },
  ];

  return (
    <Layout>
      <LayoutHeader
        title="Buku Besar (General Ledger)"
        subtitle="Rangkuman saldo dari seluruh akun akuntansi Koperasi Kasmir."
      />
      <LayoutContent>
        <DataStateView
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          hasData={rows.length > 0}
          emptyTitle="Belum ada data akun"
          emptyMessage="Buku besar masih kosong."
        >
          <VStack gap={4}>
            <Table
              data={rows}
              columns={columns}
              rowKey="id"
            />
          </VStack>
        </DataStateView>
      </LayoutContent>
    </Layout>
  );
}
