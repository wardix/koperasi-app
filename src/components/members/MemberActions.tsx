'use client';

import { HStack } from '@astryxdesign/core/Layout';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
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
 * Action icon buttons for each member row in the members table.
 * Receives all handlers as props — no data fetching.
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
  return (
    <HStack gap={1}>
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
      {permissions.canUpdate && (
        <IconButton
          icon={<Icon icon={KeyIcon} />}
          label={member.hasPortalAccess ? 'Portal aktif' : 'Akses portal'}
          variant="ghost"
          size="sm"
          onClick={() => onPortalAccess(member)}
        />
      )}
      {permissions.canUpdateSavings && (
        <IconButton
          icon={<Icon icon={BanknotesIcon} />}
          label="Setor"
          variant="ghost"
          size="sm"
          onClick={() => onUpdateSavings(member)}
        />
      )}
      <IconButton
        icon={<Icon icon={ClockIcon} />}
        label="Riwayat"
        variant="ghost"
        size="sm"
        onClick={() => onShowHistory(member)}
      />
      {permissions.canDelete && (
        <IconButton
          icon={<Icon icon={TrashIcon} />}
          label="Hapus"
          variant="ghost"
          color="error"
          size="sm"
          onClick={() => onDelete(member)}
        />
      )}
    </HStack>
  );
}
