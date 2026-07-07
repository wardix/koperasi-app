'use client';

import {DialogHeader} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  VStack,
} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Badge} from '@astryxdesign/core/Badge';
import {useApiQuery} from './hooks/useApiQuery';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon, ClockIcon} from '@heroicons/react/24/outline';
import type {MemberRow} from '../shared/types';

interface Transaction {
  id: string;
  memberId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  createdBy: string;
}

export function TransactionHistoryDialogContent({
  onClose,
  member,
}: {
  onClose: () => void;
  member: MemberRow;
}) {
  const { data: transactions, isLoading, error } = useApiQuery<Transaction[]>(`/api/members/${member.id}/transactions`);

  const columns: TableColumn<Transaction>[] = [
    {
      key: 'createdAt',
      header: 'Waktu',
      width: proportional(1.5),
      renderCell: (item: Transaction) => (
        <Text type="body">
          {new Date(item.createdAt).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </Text>
      ),
    },
    {
      key: 'type',
      header: 'Tipe',
      width: pixel(100),
      renderCell: (item: Transaction) => (
        <Badge color={item.type === 'setor' ? 'success' : 'warning'}>
          {item.type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1),
      renderCell: (item: Transaction) => (
        <Text type="body" color={item.type === 'setor' ? 'success' : 'neutral'}>
          {item.type === 'setor' ? '+' : '-'} Rp {item.amount.toLocaleString('id-ID')}
        </Text>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Akhir',
      width: proportional(1),
      renderCell: (item: Transaction) => (
        <Text type="body">Rp {item.balanceAfter.toLocaleString('id-ID')}</Text>
      ),
    },
  ];

  return (
    <Layout
      header={
        <DialogHeader
          title="Riwayat Transaksi"
          subtitle={`Rekam jejak transaksi simpanan untuk ${member.name}`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {isLoading ? (
              <Center style={{height: 200}}>
                <Spinner size="lg" />
              </Center>
            ) : error ? (
              <EmptyState
                icon={ExclamationCircleIcon}
                title="Gagal Memuat"
                description="Terjadi kesalahan saat mengambil riwayat transaksi."
              />
            ) : !transactions || transactions.length === 0 ? (
              <EmptyState
                icon={ClockIcon}
                title="Belum Ada Transaksi"
                description="Anggota ini belum memiliki riwayat transaksi simpanan."
              />
            ) : (
              <Table<Transaction>
                data={transactions}
                columns={columns}
                idKey="id"
                density="balanced"
                dividers="rows"
                hasHover
              />
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
