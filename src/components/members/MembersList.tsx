'use client';

import { useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { formatRp } from '../../utils/format';
import type { MemberRow } from '../../shared/types';
import { MemberActions } from './MemberActions';

interface MembersListProps {
  members: MemberRow[];
  permissions: {
    canUpdate: boolean;
    canRead: boolean;
    canUpdateSavings: boolean;
    canDelete: boolean;
  };
  onEdit: (member: MemberRow) => void;
  onPreviewPortal: (member: MemberRow) => void;
  onPortalAccess: (member: MemberRow) => void;
  onUpdateSavings: (member: MemberRow) => void;
  onShowHistory: (member: MemberRow) => void;
  onDelete: (member: MemberRow) => void;
}

/**
 * Members table with columns definition and per-row actions.
 * Pure presentational — no data fetching, no state management.
 */
export function MembersList({
  members,
  permissions,
  onEdit,
  onPreviewPortal,
  onPortalAccess,
  onUpdateSavings,
  onShowHistory,
  onDelete,
}: MembersListProps) {
  const columns: TableColumn<MemberRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Nama',
        width: proportional(2),
        renderCell: (item: MemberRow) => (
          <HStack gap={3} vAlign="center">
            <Avatar name={item.name} size="small" />
            <VStack gap={0}>
              <Text type="body">{item.name}</Text>
              <Text type="supporting" color="secondary">{item.role}</Text>
            </VStack>
          </HStack>
        ),
      },
      {
        key: 'nik',
        header: 'NIK',
        width: pixel(150),
        renderCell: (item: MemberRow) => (
          <Text type="body" color={item.nik ? undefined : 'secondary'}>
            {item.nik || '—'}
          </Text>
        ),
      },
      {
        key: 'phone',
        header: 'Telepon',
        width: pixel(130),
        renderCell: (item: MemberRow) => (
          <Text type="body" color={item.phone ? undefined : 'secondary'}>
            {item.phone || '—'}
          </Text>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: pixel(100),
        renderCell: (item: MemberRow) => (
          <Badge
            variant={item.status === 'Aktif' ? 'success' : 'neutral'}
            label={item.status}
          />
        ),
      },
      {
        key: 'joinDate',
        header: 'Tanggal Bergabung',
        width: proportional(1),
        renderCell: (item: MemberRow) => <Text type="body">{item.joinDate}</Text>,
      },
      {
        key: 'totalSavings',
        header: 'Total Simpanan',
        width: proportional(1.5),
        renderCell: (item: MemberRow) => (
          <VStack gap={1}>
            <Text type="body">{formatRp(item.totalSavings)}</Text>
            <Text type="supporting" color="secondary" style={{ fontSize: '12px' }}>
              Pokok: {formatRp(item.simpananPokok)}
            </Text>
            <Text type="supporting" color="secondary" style={{ fontSize: '12px' }}>
              Wajib: {formatRp(item.simpananWajib)}
            </Text>
            <Text type="supporting" color="secondary" style={{ fontSize: '12px' }}>
              Sukarela: {formatRp(item.simpananSukarela)}
            </Text>
          </VStack>
        ),
      },
      {
        key: 'actions',
        header: 'Aksi',
        width: pixel(260),
        renderCell: (item: MemberRow) => (
          <MemberActions
            member={item}
            permissions={permissions}
            onEdit={onEdit}
            onPreviewPortal={onPreviewPortal}
            onPortalAccess={onPortalAccess}
            onUpdateSavings={onUpdateSavings}
            onShowHistory={onShowHistory}
            onDelete={onDelete}
          />
        ),
      },
    ],
    [permissions, onEdit, onPreviewPortal, onPortalAccess, onUpdateSavings, onShowHistory, onDelete]
  );

  return (
    <Table<MemberRow>
      data={members}
      columns={columns}
      idKey="id"
      density="balanced"
      dividers="rows"
      hasHover
    />
  );
}
