'use client';

import { useMemo } from 'react';
import { HStack } from '@astryxdesign/core/Layout';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu';
import {
  PencilIcon,
  TrashIcon,
  BanknotesIcon,
  ClockIcon,
  KeyIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { MemberRow } from '../../shared/types';

interface MemberActionsProps {
  member: MemberRow;
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
 * Action buttons for each member row in the members table.
 * Shows primary actions directly (Edit, Lihat Portal) and
 * groups secondary actions (Akses Portal, Setor, Riwayat, Hapus) inside MoreMenu.
 */
export function MemberActions({
  member,
  permissions,
  onEdit,
  onPreviewPortal,
  onPortalAccess,
  onUpdateSavings,
  onShowHistory,
  onDelete,
}: MemberActionsProps) {
  const moreMenuItems = useMemo<DropdownMenuOption[]>(() => {
    const items: DropdownMenuOption[] = [];

    if (permissions.canUpdate) {
      items.push({
        label: member.hasPortalAccess ? 'Kelola Akses Portal' : 'Beri Akses Portal',
        icon: <Icon icon={KeyIcon} size="sm" />,
        onClick: () => onPortalAccess(member),
      });
    }

    if (permissions.canUpdateSavings) {
      items.push({
        label: 'Setor Simpanan',
        icon: <Icon icon={BanknotesIcon} size="sm" />,
        onClick: () => onUpdateSavings(member),
      });
    }

    items.push({
      label: 'Riwayat Transaksi',
      icon: <Icon icon={ClockIcon} size="sm" />,
      onClick: () => onShowHistory(member),
    });

    if (permissions.canDelete) {
      items.push({ type: 'divider' });
      items.push({
        label: 'Hapus Anggota',
        icon: <Icon icon={TrashIcon} size="sm" />,
        onClick: () => onDelete(member),
      });
    }

    return items;
  }, [member, permissions, onPortalAccess, onUpdateSavings, onShowHistory, onDelete]);

  return (
    <HStack gap={1} vAlign="center">
      {permissions.canUpdate && (
        <IconButton
          icon={<Icon icon={PencilIcon} />}
          label="Edit"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(member)}
        />
      )}
      {permissions.canRead && (
        <IconButton
          icon={<Icon icon={EyeIcon} />}
          label="Lihat portal anggota"
          variant="ghost"
          size="sm"
          onClick={() => onPreviewPortal(member)}
        />
      )}
      {moreMenuItems.length > 0 && (
        <MoreMenu
          items={moreMenuItems}
          label="Opsi anggota"
          variant="ghost"
          size="sm"
        />
      )}
    </HStack>
  );
}
