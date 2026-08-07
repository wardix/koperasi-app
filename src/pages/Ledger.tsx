'use client';

import React from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  StackItem,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import { DataStateView } from '../components/DataStateView';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';

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

  const columns: TableColumn<LedgerRow>[] = React.useMemo(() => [
    {
      key: 'code',
      header: 'Kode Akun',
      width: proportional(15),
      renderCell: (item) => <Text style={{ fontWeight: 600 }}>{item.code}</Text>,
    },
    {
      key: 'name',
      header: 'Nama Akun',
      width: proportional(30),
      renderCell: (item) => (
        <VStack gap={1}>
          <Text>{item.name}</Text>
          <Text type="supporting" color="secondary">{item.type}</Text>
        </VStack>
      ),
    },
    {
      key: 'total_debit',
      header: 'Total Debit',
      width: proportional(15),
      renderCell: (item) => <Text style={{ textAlign: 'right' }}>{formatRp(Number(item.total_debit))}</Text>,
    },
    {
      key: 'total_credit',
      header: 'Total Kredit',
      width: proportional(15),
      renderCell: (item) => <Text style={{ textAlign: 'right' }}>{formatRp(Number(item.total_credit))}</Text>,
    },
    {
      key: 'balance',
      header: 'Saldo Akhir',
      width: proportional(25),
      renderCell: (item) => (
        <Text style={{ textAlign: 'right', fontWeight: 600 }}>
          {formatRp(Number(item.balance))}
        </Text>
      ),
    },
  ], []);

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Buku Besar (General Ledger)</Heading>
              <Text type="supporting" color="secondary">
                Rangkuman saldo dari seluruh akun akuntansi Koperasi Kasmir.
              </Text>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <DataStateView
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
          >
            {rows.length === 0 ? (
              <Center style={{ height: '300px' }}>
                <EmptyState
                  title="Belum ada data akun"
                  description="Buku besar masih kosong. Pastikan migrasi akun sudah dijalankan."
                />
              </Center>
            ) : (
              <Table<LedgerRow>
                data={rows}
                columns={columns}
                idKey="id"
                density="balanced"
                dividers="rows"
                hasHover
              />
            )}
          </DataStateView>
        </LayoutContent>
      }
    />
  );
}
