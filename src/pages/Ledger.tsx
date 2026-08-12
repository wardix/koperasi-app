'use client';

import React, { useState } from 'react';
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
import { formatRp, formatDate } from '../utils/format';
import { DataStateView } from '../components/DataStateView';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Card } from '@astryxdesign/core/Card';

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

type TransactionRow = {
  id: string;
  transaction_date: string;
  reference_type: string;
  reference_id: string;
  journal_description: string;
  line_description: string;
  debit: number;
  credit: number;
  balance: number;
}

type LedgerDetailsResponse = {
  account: { code: string; name: string; type: string; normal_balance: string };
  openingBalance: number;
  transactions: TransactionRow[];
  closingBalance: number;
}

export default function Ledger() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. Query Trial Balance (All accounts summary - used for selector)
  const allAccountsQueryString = `/api/accounting/ledger?startDate=${startDate}&endDate=${endDate}`;
  const {
    data: allAccountsData,
    isLoading: isAllAccountsLoading,
    error: allAccountsError,
    refetch: refetchAllAccounts,
  } = useApiQuery<LedgerRow[]>(allAccountsQueryString);

  const allAccounts = Array.isArray(allAccountsData) ? allAccountsData : [];

  // 2. Query Specific Ledger Details if account selected
  const detailsQueryString = `/api/accounting/ledger/${selectedAccountId}?startDate=${startDate}&endDate=${endDate}`;
  const {
    data: ledgerDetails,
    isLoading: isDetailsLoading,
    error: detailsError,
    refetch: refetchDetails,
  } = useApiQuery<LedgerDetailsResponse>(selectedAccountId ? detailsQueryString : null);

  const trialColumns: TableColumn<LedgerRow>[] = React.useMemo(() => [
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

  const detailColumns: TableColumn<TransactionRow>[] = React.useMemo(() => [
    {
      key: 'transaction_date',
      header: 'Tanggal',
      width: proportional(15),
      renderCell: (item) => <Text>{formatDate(item.transaction_date)}</Text>,
    },
    {
      key: 'description',
      header: 'Keterangan',
      width: proportional(35),
      renderCell: (item) => (
        <VStack gap={1}>
          <Text>{item.line_description || item.journal_description || '-'}</Text>
          {item.reference_type && (
            <Text type="supporting" color="secondary">
              Ref: {item.reference_type.replace(/_/g, ' ')}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'debit',
      header: 'Debit',
      width: proportional(15),
      renderCell: (item) => <Text style={{ textAlign: 'right', color: item.debit ? 'var(--color-success-500)' : 'inherit' }}>{formatRp(Number(item.debit))}</Text>,
    },
    {
      key: 'credit',
      header: 'Kredit',
      width: proportional(15),
      renderCell: (item) => <Text style={{ textAlign: 'right', color: item.credit ? 'var(--color-critical-500)' : 'inherit' }}>{formatRp(Number(item.credit))}</Text>,
    },
    {
      key: 'balance',
      header: 'Saldo Berjalan',
      width: proportional(20),
      renderCell: (item) => <Text style={{ textAlign: 'right', fontWeight: 600 }}>{formatRp(Number(item.balance))}</Text>,
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
                Rincian riwayat transaksi dan saldo dari setiap akun Koperasi.
              </Text>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <VStack gap={4}>
            <Card style={{ padding: '16px' }}>
              <HStack gap={4} vAlign="end">
                <StackItem size="fill">
                  <VStack gap={1}>
                    <Text type="supporting">Pilih Akun</Text>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <option value="">-- Tampilkan Semua Akun (Neraca Saldo) --</option>
                      {allAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </VStack>
                </StackItem>
                <StackItem>
                  <VStack gap={1}>
                    <Text type="supporting">Mulai Tanggal</Text>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      style={{ 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)'
                      }} 
                    />
                  </VStack>
                </StackItem>
                <StackItem>
                  <VStack gap={1}>
                    <Text type="supporting">Sampai Tanggal</Text>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      style={{ 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-background-primary)',
                        color: 'var(--color-text-primary)'
                      }} 
                    />
                  </VStack>
                </StackItem>
              </HStack>
            </Card>

            {selectedAccountId ? (
              <DataStateView
                isLoading={isDetailsLoading}
                error={detailsError}
                onRetry={refetchDetails}
              >
                {ledgerDetails && (
                  <VStack gap={3}>
                    <HStack justifyContent="space-between" vAlign="center" style={{ padding: '8px 16px', backgroundColor: 'var(--color-background-secondary)', borderRadius: '6px' }}>
                      <Text style={{ fontWeight: 600 }}>
                        SALDO AWAL (sebelum {startDate ? formatDate(startDate) : 'periode ini'})
                      </Text>
                      <Text style={{ fontWeight: 600, fontSize: '1.1em' }}>
                        {formatRp(ledgerDetails.openingBalance)}
                      </Text>
                    </HStack>

                    {ledgerDetails.transactions.length === 0 ? (
                      <Center style={{ height: '200px' }}>
                        <EmptyState
                          title="Tidak ada transaksi"
                          description="Belum ada transaksi untuk akun ini pada periode yang dipilih."
                        />
                      </Center>
                    ) : (
                      <Table<TransactionRow>
                        data={ledgerDetails.transactions}
                        columns={detailColumns}
                        idKey="id"
                        density="balanced"
                        dividers="rows"
                        hasHover
                      />
                    )}

                    <HStack justifyContent="space-between" vAlign="center" style={{ padding: '8px 16px', backgroundColor: 'var(--color-background-subtle)', borderRadius: '6px' }}>
                      <Text style={{ fontWeight: 600 }}>
                        SALDO AKHIR (per {endDate ? formatDate(endDate) : 'sekarang'})
                      </Text>
                      <Text style={{ fontWeight: 600, fontSize: '1.2em' }}>
                        {formatRp(ledgerDetails.closingBalance)}
                      </Text>
                    </HStack>
                  </VStack>
                )}
              </DataStateView>
            ) : (
              <DataStateView
                isLoading={isAllAccountsLoading}
                error={allAccountsError}
                onRetry={refetchAllAccounts}
              >
                {allAccounts.length === 0 ? (
                  <Center style={{ height: '300px' }}>
                    <EmptyState
                      title="Belum ada data akun"
                      description="Buku besar masih kosong. Pastikan migrasi akun sudah dijalankan."
                    />
                  </Center>
                ) : (
                  <Table<LedgerRow>
                    data={allAccounts}
                    columns={trialColumns}
                    idKey="id"
                    density="balanced"
                    dividers="rows"
                    hasHover
                  />
                )}
              </DataStateView>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
