'use client';

import { useState, useMemo } from 'react';
import {
  VStack,
  HStack,
  Layout,
  LayoutHeader,
  LayoutContent,
  StackItem,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Icon } from '@astryxdesign/core/Icon';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/solid';
import { useApiQuery } from '../hooks/useApiQuery';
import { DataStateView } from '../components/DataStateView';

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string | null;
  created_at: string;
}

// Action labels for display
const ACTION_LABELS: Record<string, string> = {
  create_admin: 'Buat Admin',
  update_admin: 'Ubah Admin',
  delete_admin: 'Hapus Admin',
  approve_loan: 'Setujui Pinjaman',
  reject_loan: 'Tolak Pinjaman',
  create_member: 'Buat Anggota',
  update_member: 'Ubah Anggota',
  delete_member: 'Hapus Anggota',
  update_savings: 'Ubah Simpanan',
  update_settings: 'Ubah Pengaturan',
  close_shu: 'Tutup SHU',
  reopen_shu: 'Buka Kembali SHU',
  create_payment: 'Catat Pembayaran',
  update_payment: 'Ubah Pembayaran',
  delete_payment: 'Hapus Pembayaran',
  update_loan_disbursement: 'Ubah Tanggal Pencairan',
  create_expense: 'Catat Pengeluaran',
  update_expense: 'Ubah Pengeluaran',
  delete_expense: 'Hapus Pengeluaran',
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatEntityLabel(entity: string, entityId?: string | null): string {
  if (entityId) {
    const shortId = entityId.length > 8 ? entityId.slice(0, 8) + '...' : entityId;
    return `${entity} (${shortId})`;
  }
  return entity;
}

function formatChange(before?: Record<string, unknown>, after?: Record<string, unknown>): string {
  if (!before && !after) return '-';
  const changes: string[] = [];

  // Find all keys from both before and after
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of allKeys) {
    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (oldVal === undefined && newVal !== undefined) {
      changes.push(`${key}: +${JSON.stringify(newVal)}`);
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push(`${key}: -${JSON.stringify(oldVal)}`);
    } else if (oldVal !== newVal) {
      const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal).slice(0, 50) : String(oldVal);
      const newStr = typeof newVal === 'object' ? JSON.stringify(newVal).slice(0, 50) : String(newVal);
      changes.push(`${key}: ${oldStr} → ${newStr}`);
    }
  }

  return changes.length > 0 ? changes.join('; ') : '-';
}

export default function AuditLog() {
  const [filters, setFilters] = useState({
    actor: '',
    action: '',
    entity: '',
    from: '',
    to: '',
  });

  // Build query params for the API call
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.actor) params.set('actor', filters.actor);
    if (filters.action) params.set('action', filters.action);
    if (filters.entity) params.set('entity', filters.entity);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return params.toString();
  }, [filters]);

  const { data, isLoading, error } = useApiQuery<AuditLogEntry[]>(
    `/api/v1/audit-logs${queryParams ? '?' + queryParams : ''}`
  );

  const entries = data || [];

  // Extract unique values for filter dropdowns
  const uniqueActors = useMemo(() => {
    const actors = new Set(entries.map(e => e.actor));
    return Array.from(actors).sort();
  }, [entries]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(entries.map(e => e.action));
    return Array.from(actions).sort();
  }, [entries]);

  const uniqueEntities = useMemo(() => {
    const entities = new Set(entries.map(e => e.entity));
    return Array.from(entities).sort();
  }, [entries]);

  // Columns for the table
  const columns: TableColumn<AuditLogEntry>[] = [
    { key: 'created_at', header: 'Waktu', width: pixel(140), renderCell: (item) => formatTimestamp(item.created_at) },
    { key: 'actor', header: 'Aktor', width: proportional(1.5), renderCell: (item) => item.actor || '-' },
    { key: 'action', header: 'Aksi', width: pixel(180), renderCell: (item) => ACTION_LABELS[item.action] || item.action },
    { key: 'entity', header: 'Entitas', width: pixel(150), renderCell: (item) => formatEntityLabel(item.entity, item.entity_id) },
    { key: 'changes', header: 'Perubahan', width: proportional(2), renderCell: (item) => formatChange(item.before, item.after) },
    { key: 'ip', header: 'IP', width: pixel(100), renderCell: (item) => item.ip || '-' },
  ];

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--radius-md, 6px)',
    border: '1px solid var(--color-border-primary)',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
  };

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack hAlign="between" vAlign="center" style={{ width: '100%' }}>
            <StackItem>
              <HStack gap={2} vAlign="center">
                <Icon icon={ClipboardDocumentCheckIcon} size="md" color="primary" />
                <Heading level={2}>Log Audit</Heading>
              </HStack>
            </StackItem>
            <StackItem>
              <Text type="supporting" color="secondary">Catatan operasi administratif sensitif</Text>
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        <DataStateView isLoading={isLoading} error={error} onRetry={() => window.location.reload()} errorTitle="Gagal Memuat Log Audit">
          <VStack gap={4}>
            {/* Filters */}
            <Card style={{ padding: 16 }}>
              <VStack gap={3}>
                <Heading level={4}>Filter Riwayat</Heading>
                <HStack gap={4} wrap="wrap">
                  <VStack gap={1}>
                    <Text type="supporting" size="xs">Aktor</Text>
                    <select
                      value={filters.actor}
                      onChange={(e) => setFilters(f => ({ ...f, actor: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Semua Aktor</option>
                      {uniqueActors.map(actor => (
                        <option key={actor} value={actor}>{actor}</option>
                      ))}
                    </select>
                  </VStack>

                  <VStack gap={1}>
                    <Text type="supporting" size="xs">Aksi</Text>
                    <select
                      value={filters.action}
                      onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Semua Aksi</option>
                      {uniqueActions.map(action => (
                        <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>
                      ))}
                    </select>
                  </VStack>

                  <VStack gap={1}>
                    <Text type="supporting" size="xs">Entitas</Text>
                    <select
                      value={filters.entity}
                      onChange={(e) => setFilters(f => ({ ...f, entity: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Semua Entitas</option>
                      {uniqueEntities.map(entity => (
                        <option key={entity} value={entity}>{entity}</option>
                      ))}
                    </select>
                  </VStack>

                  <VStack gap={1}>
                    <Text type="supporting" size="xs">Dari Tanggal</Text>
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                      style={inputStyle}
                    />
                  </VStack>

                  <VStack gap={1}>
                    <Text type="supporting" size="xs">Sampai Tanggal</Text>
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                      style={inputStyle}
                    />
                  </VStack>
                </HStack>
              </VStack>
            </Card>

            {/* Audit Log Table */}
            {entries.length === 0 ? (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <Text type="supporting" color="secondary">Tidak ada log audit yang sesuai dengan filter</Text>
              </Card>
            ) : (
              <Card style={{ overflow: 'hidden' }}>
                <Table
                  data={entries}
                  columns={columns}
                  idKey="id"
                  density="compact"
                  dividers="rows"
                  hasHover
                />
              </Card>
            )}

            {/* Summary */}
            {entries.length > 0 && (
              <Text type="supporting" color="secondary">
                Menampilkan {entries.length} entri log
              </Text>
            )}
          </VStack>
        </DataStateView>
      </LayoutContent>
    </Layout>
  );
}
