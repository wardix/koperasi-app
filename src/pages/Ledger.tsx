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
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp, formatDate } from '../utils/format';
import { DataStateView } from '../components/DataStateView';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Card } from '@astryxdesign/core/Card';
import { Icon } from '@astryxdesign/core/Icon';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@astryxdesign/core/Spinner';

type LedgerRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  opening_balance: number;
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

// Sub-component to fetch and render the expanded transaction details
function ExpandedTransactions({ accountId, startDate, endDate }: { accountId: string, startDate: string, endDate: string }) {
  const queryStr = `/api/accounting/ledger/${accountId}?startDate=${startDate}&endDate=${endDate}`;
  const { data, isLoading, error } = useApiQuery<LedgerDetailsResponse>(queryStr);

  if (isLoading) return <Center style={{ padding: 20 }}><Spinner /></Center>;
  if (error) return <Text color="critical">Gagal memuat rincian transaksi.</Text>;
  if (!data) return null;

  return (
    <div style={{ padding: '16px 32px', backgroundColor: 'var(--color-background-subtle)', borderTop: '1px solid var(--color-border)' }}>
      <Text style={{ fontWeight: 600, marginBottom: 8 }}>Histori Transaksi Akun {data.account.name}</Text>
      
      {data.transactions.length === 0 ? (
        <Text type="supporting" color="secondary">Tidak ada transaksi pada periode ini.</Text>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px 4px', fontWeight: 600, fontSize: 13 }}>Tanggal</th>
              <th style={{ padding: '8px 4px', fontWeight: 600, fontSize: 13 }}>Keterangan</th>
              <th style={{ padding: '8px 4px', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>Debit</th>
              <th style={{ padding: '8px 4px', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>Kredit</th>
              <th style={{ padding: '8px 4px', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>Saldo Berjalan</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px dashed var(--color-border)' }}>
              <td colSpan={2} style={{ padding: '8px 4px', fontStyle: 'italic', fontSize: 13 }}>Saldo Awal</td>
              <td colSpan={2}></td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, fontSize: 13 }}>{formatRp(data.openingBalance)}</td>
            </tr>
            {data.transactions.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <td style={{ padding: '8px 4px', fontSize: 13 }}>{formatDate(item.transaction_date)}</td>
                <td style={{ padding: '8px 4px', fontSize: 13 }}>
                  <Text>{item.line_description || item.journal_description || '-'}</Text>
                  {item.reference_type && (
                    <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                      Ref: {item.reference_type.replace(/_/g, ' ')}
                    </Text>
                  )}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 13, color: item.debit ? 'var(--color-success-500)' : 'inherit' }}>
                  {item.debit ? formatRp(Number(item.debit)) : '-'}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 13, color: item.credit ? 'var(--color-critical-500)' : 'inherit' }}>
                  {item.credit ? formatRp(Number(item.credit)) : '-'}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                  {formatRp(Number(item.balance))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Ledger() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const allAccountsQueryString = `/api/accounting/ledger?startDate=${startDate}&endDate=${endDate}`;
  const {
    data: allAccountsData,
    isLoading: isAllAccountsLoading,
    error: allAccountsError,
    refetch: refetchAllAccounts,
  } = useApiQuery<LedgerRow[]>(allAccountsQueryString);

  const rows = Array.isArray(allAccountsData) ? allAccountsData : [];

  const toggleRow = (id: string) => {
    const next = new Set(expandedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRowIds(next);
  };

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Buku Besar (General Ledger)</Heading>
              <Text type="supporting" color="secondary">
                Rangkuman neraca saldo berjalan. Klik baris akun untuk melihat rincian mutasi (drill-down).
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
                <StackItem>
                  <VStack gap={1}>
                    <Text type="supporting">Periode Mulai</Text>
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
                    <Text type="supporting">Periode Sampai</Text>
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

            <DataStateView
              isLoading={isAllAccountsLoading}
              error={allAccountsError}
              onRetry={refetchAllAccounts}
            >
              {rows.length === 0 ? (
                <Center style={{ height: '300px' }}>
                  <EmptyState
                    title="Tidak ada aktivitas"
                    description="Tidak ada mutasi atau saldo pada periode ini."
                  />
                </Center>
              ) : (
                <Card style={{ overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                      <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 600, width: 40 }}></th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Kode Akun</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Akun</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Saldo Awal</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Kredit</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Saldo Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(item => {
                        const isExpanded = expandedRowIds.has(item.id);
                        return (
                          <React.Fragment key={item.id}>
                            <tr 
                              onClick={() => toggleRow(item.id)}
                              style={{ 
                                borderBottom: '1px solid var(--color-border-primary)',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-subtle)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <Icon icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} size="sm" />
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600, fontFamily: 'monospace' }}>{item.code}</td>
                              <td style={{ padding: '12px 8px' }}>
                                <VStack gap={1}>
                                  <Text>{item.name}</Text>
                                  <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>{item.type}</Text>
                                </VStack>
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(Number(item.opening_balance))}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'right', color: item.total_debit ? 'var(--color-success-500)' : 'inherit' }}>{formatRp(Number(item.total_debit))}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'right', color: item.total_credit ? 'var(--color-critical-500)' : 'inherit' }}>{formatRp(Number(item.total_credit))}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatRp(Number(item.balance))}</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} style={{ padding: 0 }}>
                                  <ExpandedTransactions accountId={item.id} startDate={startDate} endDate={endDate} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}
            </DataStateView>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
