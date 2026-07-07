// Copyright (c) Meta Platforms, Inc. and affiliates.

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
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {PowerSearch, usePowerSearchConfig} from '@astryxdesign/core/PowerSearch';
import type {PowerSearchFilter} from '@astryxdesign/core/PowerSearch';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {
  FunnelIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  TrashIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import {useImperativeDialog} from '@astryxdesign/core/Dialog';
import {AddMemberDialogContent} from './AddMemberDialog.tsx';
import {UpdateSavingsDialogContent} from './UpdateSavingsDialog.tsx';
import {apiUrl} from './config';

interface MemberRow extends Record<string, unknown> {
  id: string;
  name: string;
  role: string;
  status: string;
  joinDate: string;
  totalSavings: number;
}



const statusValues = [
  {value: 'Aktif', label: 'Aktif'},
  {value: 'Pasif', label: 'Pasif'},
];

const roleValues = [
  {value: 'Anggota', label: 'Anggota'},
  {value: 'Ketua', label: 'Ketua'},
  {value: 'Bendahara', label: 'Bendahara'},
  {value: 'Sekretaris', label: 'Sekretaris'},
];

const fieldDefs = [
  {key: 'name', type: 'string', label: 'Nama'},
  {key: 'role', type: 'enum', label: 'Jabatan', enumValues: roleValues},
  {key: 'status', type: 'enum', label: 'Status', enumValues: statusValues},
  {key: 'joinDate', type: 'string', label: 'Tanggal Bergabung'},
] as const;

export default function MembersTemplate() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Anggota');
  const dialog = useImperativeDialog({purpose: 'form', width: 480});

  useEffect(() => {
    fetch(apiUrl('/api/members'))
      .then(res => res.json())
      .then(data => setMembers(data))
      .catch(err => console.error("Error fetching members:", err));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/members/${id}`), { method: 'DELETE' });
      setMembers(members.filter(m => m.id !== id));
    } catch (err) {
      console.error("Error deleting member:", err);
    }
  };

  const handleUpdateSavings = (id: string) => {
    dialog.show(
      <UpdateSavingsDialogContent 
        onClose={() => dialog.hide()}
        onSave={async (additionalSavings) => {
          try {
            const res = await fetch(apiUrl(`/api/members/${id}/savings`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ additionalSavings })
            });
            const data = await res.json();
            if (data.success) {
              setMembers(members.map(m => m.id === id ? { ...m, totalSavings: data.newTotal } : m));
            }
          } catch (err) {
            console.error("Error updating savings:", err);
          }
        }}
      />
    );
  };

  const columns: TableColumn<MemberRow>[] = [
    {
      key: 'name',
      header: 'Nama',
      width: proportional(2),
      renderCell: (item: MemberRow) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={item.name} size="small" />
          <VStack gap={0}>
            <Text type="body">{item.name}</Text>
            <Text type="supporting" color="secondary">
              {item.role}
            </Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(100),
      renderCell: (item: MemberRow) => (
        <Badge color={item.status === 'Aktif' ? 'success' : 'neutral'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'joinDate',
      header: 'Tanggal Bergabung',
      width: proportional(1),
      renderCell: (item: MemberRow) => (
        <Text type="body">{item.joinDate}</Text>
      ),
    },
    {
      key: 'totalSavings',
      header: 'Total Simpanan',
      width: proportional(1),
      renderCell: (item: MemberRow) => <Text type="body">{'Rp ' + item.totalSavings.toLocaleString('id-ID')}</Text>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(100),
      renderCell: (item: MemberRow) => (
        <HStack gap={1}>
          <IconButton 
            icon={<Icon icon={BanknotesIcon} />} 
            label="Setor" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleUpdateSavings(item.id)} 
          />
          <IconButton 
            icon={<Icon icon={TrashIcon} />} 
            label="Hapus" 
            variant="ghost" 
            color="error" 
            size="sm" 
            onClick={() => handleDelete(item.id)} 
          />
        </HStack>
      ),
    },
  ];

  const filtered = useMemo(() => {
    return applyFilters(filters, members);
  }, [filters, applyFilters, members]);

  const handleAddMember = () => {
    dialog.show(
      <AddMemberDialogContent
        onClose={() => dialog.hide()}
        onAdd={async (newMember) => {
          try {
            const res = await fetch(apiUrl('/api/members'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newMember)
            });
            const data = await res.json();
            if (data.success) {
              setMembers([{ ...newMember, id: data.id }, ...members]);
            }
          } catch (err) {
            console.error("Error saving member:", err);
          }
        }}
      />
    );
  };

  return (
    <>
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Data Anggota</Heading>
            </StackItem>
            <IconButton
              label="Filter"
              icon={<Icon icon={FunnelIcon} size="sm" />}
              variant="ghost"
            />
            <IconButton
              label="Unduh"
              icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
              variant="ghost"
            />
            <Button
              label="Tambah Anggota"
              icon={<Icon icon={PlusIcon} size="sm" />}
              onClick={handleAddMember}
            />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <VStack gap={4}>
            <PowerSearch
              config={config}
              filters={filters}
              onChange={newFilters => {
                setFilters([...newFilters]);
              }}
              placeholder="Cari anggota..."
              resultCount={filtered.length}
            />
            <Table<MemberRow>
              data={filtered}
              columns={columns}
              idKey="id"
              density="balanced"
              dividers="rows"
              hasHover
            />
          </VStack>
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
