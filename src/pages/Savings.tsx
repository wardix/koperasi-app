'use client';

import {useState, useMemo, useEffect} from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {useApiQuery} from '../hooks/useApiQuery';
import {formatRp} from '../utils/format';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {ImportSavingsDialogContent} from '../components/ImportSavingsDialog';
import {ApproveSavingsWithdrawalDialogContent} from '../components/ApproveSavingsWithdrawalDialog';
import {RejectSavingsWithdrawalDialogContent} from '../components/RejectSavingsWithdrawalDialog';
import {useAuth} from '../hooks/useAuth';

import type {SavingsTransactionRow, SavingsWithdrawalRow, PaginatedResponse} from '../shared/types';

const transactionTypeValues = [
  {value: 'setor_pokok', label: 'Setor Pokok'},
  {value: 'setor_wajib', label: 'Setor Wajib'},
  {value: 'setor_sukarela', label: 'Setor Sukarela'},
  {value: 'tarik_pokok', label: 'Tarik Pokok'},
  {value: 'tarik_wajib', label: 'Tarik Wajib'},
  {value: 'tarik_sukarela', label: 'Tarik Sukarela'},
];

const fieldDefs = [
  {key: 'memberName', type: 'string', label: 'Nama Anggota'},
  {key: 'type', type: 'enum', label: 'Tipe Transaksi', enumValues: transactionTypeValues},
] as const;

export default function SavingsTemplate() {
  const dialog = useA11yDialog({purpose: 'form', width: 600});
  const {hasPermission} = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'transactions' | 'withdrawals'>('transactions');

  // Transactions state
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Simpanan');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: transactionsResponse, isLoading, error, refetch: fetchTransactions } = useApiQuery<PaginatedResponse<SavingsTransactionRow>>(`/api/savings/transactions?page=${page}&limit=${limit}`);
  const [localTransactions, setLocalTransactions] = useState<SavingsTransactionRow[]>([]);

  useEffect(() => {
    if (transactionsResponse?.data) {
      setLocalTransactions(transactionsResponse.data);
    }
  }, [transactionsResponse]);

  const filtered = useMemo(() => {
    return applyFilters(filters, localTransactions);
  }, [filters, applyFilters, localTransactions]);

  // Withdrawals state
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<string>('Semua');
  const [withdrawalPage, setWithdrawalPage] = useState<number>(1);
  const [withdrawalLimit] = useState<number>(20);

  const withdrawalQueryUrl = useMemo(() => {
    const base = `/api/savings/withdrawals?page=${withdrawalPage}&limit=${withdrawalLimit}`;
    if (withdrawalStatusFilter !== 'Semua') {
      return `${base}&status=${encodeURIComponent(withdrawalStatusFilter)}`;
    }
    return base;
  }, [withdrawalPage, withdrawalLimit, withdrawalStatusFilter]);

  const {
    data: withdrawalsResponse,
    isLoading: withdrawalsLoading,
    error: withdrawalsError,
    refetch: fetchWithdrawals,
  } = useApiQuery<PaginatedResponse<SavingsWithdrawalRow>>(withdrawalQueryUrl);

  const {
    data: pendingCountResponse,
    refetch: fetchPendingCount,
  } = useApiQuery<PaginatedResponse<SavingsWithdrawalRow>>('/api/savings/withdrawals?status=Menunggu&limit=1');

  const pendingCount = pendingCountResponse?.total ?? 0;

  const transactionColumns: TableColumn<SavingsTransactionRow>[] = useMemo(() => [
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body">{item.memberName || 'Anggota Koperasi'}</Text>
      ),
    },
    {
      key: 'type',
      header: 'Tipe Transaksi',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => {
        let label = item.type;
        let variant: 'success' | 'warning' | 'critical' | 'neutral' = 'neutral';
        
        const match = transactionTypeValues.find(t => t.value === item.type);
        if (match) {
          label = match.label;
        }

        if (item.type.startsWith('setor_')) {
          variant = 'success';
        } else if (item.type.startsWith('tarik_')) {
          variant = 'critical';
        }

        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'amount',
      header: 'Nominal',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" style={{ fontWeight: 500, color: item.type.startsWith('setor_') ? 'var(--color-success-500)' : 'var(--color-critical-500)' }}>
          {item.type.startsWith('setor_') ? '+' : '-'} {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'balanceBefore',
      header: 'Saldo Sebelum',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" color="secondary">{formatRp(item.balanceBefore)}</Text>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Sesudah',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="body" style={{ fontWeight: 500 }}>{formatRp(item.balanceAfter)}</Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Waktu',
      width: proportional(2),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">
          {new Date(item.createdAt).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ),
    },
    {
      key: 'createdBy',
      header: 'Petugas',
      width: proportional(1.5),
      renderCell: (item: SavingsTransactionRow) => (
        <Text type="supporting" color="secondary">{item.createdBy}</Text>
      ),
    },
  ], []);

  const withdrawalColumns: TableColumn<SavingsWithdrawalRow>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: 'Tanggal Pengajuan',
      width: proportional(1.8),
      renderCell: (item: SavingsWithdrawalRow) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">
            {new Date(item.createdAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
            {new Date(item.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })} WIB
          </Text>
        </VStack>
      ),
    },
    {
      key: 'memberName',
      header: 'Nama Anggota',
      width: proportional(2),
      renderCell: (item: SavingsWithdrawalRow) => (
        <VStack gap={0}>
          <Text type="body" weight="semibold">{item.memberName || 'Anggota'}</Text>
          {item.memberNik && (
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              NIK: {item.memberNik}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'amount',
      header: 'Nominal Penarikan',
      width: proportional(1.6),
      renderCell: (item: SavingsWithdrawalRow) => (
        <Text type="body" weight="bold" style={{ color: 'var(--color-critical-500, #ef4444)' }}>
          {formatRp(item.amount)}
        </Text>
      ),
    },
    {
      key: 'destinationBank',
      header: 'Rekening Tujuan',
      width: proportional(2.5),
      renderCell: (item: SavingsWithdrawalRow) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">{item.destinationBank} - {item.destinationAccount}</Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>
            a.n. {item.destinationName}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'notes',
      header: 'Catatan',
      width: proportional(2),
      renderCell: (item: SavingsWithdrawalRow) => (
        <Text type="supporting" color="secondary">
          {item.notes || '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: proportional(1.4),
      renderCell: (item: SavingsWithdrawalRow) => {
        let variant: 'success' | 'warning' | 'critical' | 'neutral' = 'neutral';
        if (item.status === 'Menunggu') variant = 'warning';
        else if (item.status === 'Disetujui') variant = 'success';
        else if (item.status === 'Ditolak') variant = 'critical';
        return <Badge variant={variant} label={item.status} />;
      },
    },
    {
      key: 'actions',
      header: 'Tindakan',
      width: proportional(2.5),
      renderCell: (item: SavingsWithdrawalRow) => {
        if (item.status === 'Menunggu') {
          if (hasPermission('update:savings')) {
            return (
              <HStack gap={2}>
                <Button
                  label="Setujui"
                  variant="primary"
                  onClick={() => {
                    dialog.show(
                      <ApproveSavingsWithdrawalDialogContent
                        withdrawal={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (payload) => {
                          try {
                            const res = await fetch(`/api/savings/withdrawals/${item.id}/approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchWithdrawals();
                              fetchPendingCount();
                              fetchTransactions();
                            } else {
                              alert(res.message || 'Gagal menyetujui penarikan');
                            }
                          } catch {
                            alert('Terjadi kesalahan jaringan');
                          }
                        }}
                      />
                    );
                  }}
                />
                <Button
                  label="Tolak"
                  variant="ghost"
                  onClick={() => {
                    dialog.show(
                      <RejectSavingsWithdrawalDialogContent
                        withdrawal={item}
                        onClose={() => dialog.hide()}
                        onConfirm={async (rejectionReason) => {
                          try {
                            const res = await fetch(`/api/savings/withdrawals/${item.id}/reject`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rejectionReason }),
                            }).then((r) => r.json());
                            if (res.success) {
                              dialog.hide();
                              fetchWithdrawals();
                              fetchPendingCount();
                              fetchTransactions();
                            } else {
                              alert(res.message || 'Gagal menolak penarikan');
                            }
                          } catch {
                            alert('Terjadi kesalahan jaringan');
                          }
                        }}
                      />
                    );
                  }}
                />
              </HStack>
            );
          }
          return <Text type="supporting" color="secondary">Menunggu persetujuan</Text>;
        }

        if (item.status === 'Disetujui') {
          return (
            <VStack gap={0}>
              <Text type="supporting" weight="medium" style={{ color: 'var(--color-success-600, #16a34a)' }}>
                ✓ Telah Dicairkan
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                {item.paymentSourceName ? `via ${item.paymentSourceName}` : ''}
              </Text>
            </VStack>
          );
        }

        return (
          <VStack gap={0}>
            <Text type="supporting" color="critical" weight="medium">
              ✗ Ditolak
            </Text>
            {item.rejectionReason && (
              <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                Alasan: {item.rejectionReason}
              </Text>
            )}
          </VStack>
        );
      },
    },
  ], [hasPermission, dialog, fetchWithdrawals, fetchPendingCount, fetchTransactions]);

  return (
    <>
      <Layout
        height="auto"
        header={
          <LayoutHeader hasDivider>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <StackItem size="fill">
                  <Heading level={1}>Pengelolaan Simpanan Anggota</Heading>
                </StackItem>
                {activeTab === 'transactions' && hasPermission('update:savings') && (
                  <Button
                    label="Import CSV Simpanan"
                    variant="secondary"
                    icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                    onClick={() => {
                      dialog.show(
                        <ImportSavingsDialogContent
                          onClose={() => dialog.hide()}
                          onSuccess={() => fetchTransactions()}
                        />
                      );
                    }}
                  />
                )}
              </HStack>

              {/* Navigation Tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  gap: 8,
                  padding: 4,
                  backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
                  borderRadius: 8,
                  width: 'fit-content',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'transactions' ? 600 : 500,
                    fontSize: 14,
                    backgroundColor: activeTab === 'transactions' ? 'var(--color-background-primary, #ffffff)' : 'transparent',
                    color: activeTab === 'transactions' ? 'var(--color-text-primary, #111827)' : 'var(--color-text-secondary, #6b7280)',
                    boxShadow: activeTab === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Riwayat Mutasi Simpanan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('withdrawals');
                    fetchWithdrawals();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'withdrawals' ? 600 : 500,
                    fontSize: 14,
                    backgroundColor: activeTab === 'withdrawals' ? 'var(--color-background-primary, #ffffff)' : 'transparent',
                    color: activeTab === 'withdrawals' ? 'var(--color-text-primary, #111827)' : 'var(--color-text-secondary, #6b7280)',
                    boxShadow: activeTab === 'withdrawals' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Permohonan Penarikan Sukarela
                  {pendingCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-warning-500, #f59e0b)',
                        color: '#ffffff',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 7px',
                        minWidth: 18,
                        height: 18,
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            </VStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={3}>
            {activeTab === 'transactions' ? (
              <DataStateView isLoading={isLoading} error={error} onRetry={fetchTransactions} errorTitle="Gagal Memuat Riwayat Transaksi">
                <VStack gap={4}>
                  <PowerSearch
                    config={config}
                    filters={filters}
                    onChange={newFilters => {
                      setFilters([...newFilters]);
                    }}
                    placeholder="Cari transaksi..."
                    resultCount={filtered.length}
                  />
                  <Table<SavingsTransactionRow>
                    data={filtered}
                    columns={transactionColumns}
                    idKey="id"
                    density="balanced"
                    dividers="rows"
                    hasHover
                  />
                  <Pagination
                    page={transactionsResponse?.page || 1}
                    limit={transactionsResponse?.limit || limit}
                    total={transactionsResponse?.total || 0}
                    onPageChange={setPage}
                  />
                </VStack>
              </DataStateView>
            ) : (
              <DataStateView
                isLoading={withdrawalsLoading}
                error={withdrawalsError}
                onRetry={fetchWithdrawals}
                errorTitle="Gagal Memuat Data Permohonan Penarikan"
              >
                <VStack gap={4}>
                  {/* Status Filter Pills */}
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Text type="supporting" weight="semibold" color="secondary">
                      Filter Status:
                    </Text>
                    {['Semua', 'Menunggu', 'Disetujui', 'Ditolak'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setWithdrawalStatusFilter(st);
                          setWithdrawalPage(1);
                        }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 13,
                          fontWeight: withdrawalStatusFilter === st ? 600 : 500,
                          cursor: 'pointer',
                          border: `1px solid ${withdrawalStatusFilter === st ? 'var(--color-primary-500, #3b82f6)' : 'var(--color-border-primary, #e5e7eb)'}`,
                          backgroundColor: withdrawalStatusFilter === st ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-background-primary, #ffffff)',
                          color: withdrawalStatusFilter === st ? 'var(--color-primary-600, #2563eb)' : 'var(--color-text-secondary, #6b7280)',
                        }}
                      >
                        {st}
                        {st === 'Menunggu' && pendingCount > 0 && ` (${pendingCount})`}
                      </button>
                    ))}
                  </HStack>

                  <Table<SavingsWithdrawalRow>
                    data={withdrawalsResponse?.data || []}
                    columns={withdrawalColumns}
                    idKey="id"
                    density="balanced"
                    dividers="rows"
                    hasHover
                  />

                  {(!withdrawalsResponse?.data || withdrawalsResponse.data.length === 0) && (
                    <VStack hAlign="center" padding={6}>
                      <Text type="body" color="secondary">
                        {withdrawalStatusFilter === 'Semua'
                          ? 'Belum ada permohonan penarikan simpanan sukarela.'
                          : `Tidak ada permohonan penarikan dengan status ${withdrawalStatusFilter}.`}
                      </Text>
                    </VStack>
                  )}

                  <Pagination
                    page={withdrawalsResponse?.page || 1}
                    limit={withdrawalsResponse?.limit || withdrawalLimit}
                    total={withdrawalsResponse?.total || 0}
                    onPageChange={setWithdrawalPage}
                  />
                </VStack>
              </DataStateView>
            )}
          </LayoutContent>
        }
      />
      {dialog.element}
    </>
  );
}
