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
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon} from '@heroicons/react/24/outline';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
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
  PencilIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {useImperativeDialog} from '@astryxdesign/core/Dialog';
import {AddMemberDialogContent} from './AddMemberDialog.tsx';
import {EditMemberDialogContent} from './EditMemberDialog.tsx';
import {UpdateSavingsDialogContent} from './UpdateSavingsDialog.tsx';
import {TransactionHistoryDialogContent} from './TransactionHistoryDialog.tsx';
import {useToast} from '@astryxdesign/core/Toast';
import {apiFetch} from './config';
import {useApiQuery} from './hooks/useApiQuery';

import type {MemberRow, PaginatedResponse} from '../shared/types';



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
  const [filters, setFilters] = useState<PowerSearchFilter[]>([]);
  const {config, applyFilters} = usePowerSearchConfig(fieldDefs, 'Anggota');
  const dialog = useImperativeDialog({purpose: 'form', width: 480});
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: membersResponse, isLoading, error, refetch: fetchMembers } = useApiQuery<PaginatedResponse<MemberRow>>(`/api/members?page=${page}&limit=${limit}`);
  
  const [members, setMembers] = useState<MemberRow[]>([]);
  
  useEffect(() => {
    if (membersResponse?.data) {
      setMembers(membersResponse.data);
    }
  }, [membersResponse]);

  const toast = useToast();

  const handleDelete = (member: MemberRow) => {
    dialog.show(
      <Card style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        <VStack gap={4}>
          <Heading level={4}>Konfirmasi Hapus</Heading>
          <Text type="body">Apakah Anda yakin ingin menghapus anggota {member.name}?</Text>
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Batal" onClick={() => dialog.hide()} />
            <Button color="error" label="Hapus" onClick={async () => {
              try {
                const res = await apiFetch(`/api/members/${member.id}`, { method: 'DELETE' });
                if (res.ok) {
                  setMembers(members.filter(m => m.id !== member.id));
                  toast.show({body: 'Anggota berhasil dihapus', type: 'info'});
                } else {
                  toast.show({body: 'Gagal menghapus anggota', type: 'error'});
                }
              } catch (err) {
                console.error("Error deleting member:", err);
                toast.show({body: 'Terjadi kesalahan sistem', type: 'error'});
              } finally {
                dialog.hide();
              }
            }} />
          </HStack>
        </VStack>
      </Card>
    );
  };

  const handleUpdateSavings = (member: MemberRow) => {
    dialog.show(
      <UpdateSavingsDialogContent 
        onClose={() => dialog.hide()}
        onSave={async (additionalSavings) => {
          try {
            const res = await apiFetch(`/api/members/${member.id}/savings`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ additionalSavings })
            });
            if (res.ok) {
              const result = await res.json();
              const updatedTotal = result.newTotal;
              setMembers(members.map(m => m.id === member.id ? { ...m, totalSavings: updatedTotal } : m));
              toast.show({body: 'Simpanan berhasil ditambahkan', type: 'info'});
            }
          } catch (err) {
            console.error("Error updating savings:", err);
          } finally {
            dialog.hide();
          }
        }}
      />
    );
  };

  const handleShowHistory = (member: MemberRow) => {
    dialog.show(
      <TransactionHistoryDialogContent
        member={member}
        onClose={() => dialog.hide()}
      />
    );
  };

  const handleEditMember = (member: MemberRow) => {
    dialog.show(
      <EditMemberDialogContent
        initialData={member}
        onClose={() => dialog.hide()}
        onEdit={async (data) => {
          try {
            const res = await apiFetch(`/api/members/${member.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (res.ok) {
              toast.show({body: 'Anggota berhasil diubah', type: 'info'});
              fetchMembers();
            } else {
              toast.show({body: 'Gagal mengubah anggota', type: 'error'});
            }
          } catch (err) {
            console.error("Error editing member:", err);
            toast.show({body: 'Gagal mengubah anggota', type: 'error'});
          } finally {
            dialog.hide();
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
            icon={<Icon icon={PencilIcon} />} 
            label="Edit" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleEditMember(item)} 
          />
          <IconButton 
            icon={<Icon icon={BanknotesIcon} />} 
            label="Setor" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleUpdateSavings(item)} 
          />
          <IconButton 
            icon={<Icon icon={ClockIcon} />} 
            label="Riwayat" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleShowHistory(item)} 
          />
          <IconButton 
            icon={<Icon icon={TrashIcon} />} 
            label="Hapus" 
            variant="ghost" 
            color="error" 
            size="sm" 
            onClick={() => handleDelete(item)} 
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
        onAdd={async (data) => {
          try {
            const res = await apiFetch('/api/members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            if (res.ok) {
              toast.show({body: 'Anggota berhasil ditambahkan', type: 'info'});
              fetchMembers();
            } else {
              toast.show({body: 'Gagal menambahkan anggota', type: 'error'});
            }
          } catch (err) {
            console.error("Error saving member:", err);
            toast.show({body: 'Terjadi kesalahan sistem', type: 'error'});
          } finally {
            dialog.hide();
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
          {isLoading ? (
            <Center style={{height: '100%'}}>
              <Spinner size="large" />
            </Center>
          ) : error ? (
            <Center style={{height: '100%'}}>
              <EmptyState
                icon={<ExclamationCircleIcon width={48} height={48} />}
                title="Gagal Memuat Data Anggota"
                description={error}
                actions={<Button label="Coba Lagi" onClick={fetchMembers} />}
              />
            </Center>
          ) : (
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
            <HStack hAlign="between" vAlign="center" padding={2}>
              <Text type="body">Halaman {membersResponse?.page || 1} dari {Math.ceil((membersResponse?.total || 0) / (membersResponse?.limit || 20)) || 1}</Text>
              <HStack gap={2}>
                <Button 
                  label="Sebelumnya" 
                  variant="outline" 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                />
                <Button 
                  label="Selanjutnya" 
                  variant="outline" 
                  disabled={page >= Math.ceil((membersResponse?.total || 0) / limit)}
                  onClick={() => setPage(p => p + 1)} 
                />
              </HStack>
            </HStack>
          </VStack>
          )}
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
