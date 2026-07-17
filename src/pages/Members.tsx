// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useState, useMemo, useEffect, useCallback} from 'react';
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
  KeyIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import {useA11yDialog} from '../hooks/useA11yDialog';
import {AddMemberDialogContent} from '../components/AddMemberDialog';
import {EditMemberDialogContent} from '../components/EditMemberDialog';
import {UpdateSavingsDialogContent} from '../components/UpdateSavingsDialog';
import {TransactionHistoryDialogContent} from '../components/TransactionHistoryDialog';
import {PortalAccessDialogContent} from '../components/PortalAccessDialog';
import {useToast} from '@astryxdesign/core/Toast';
import {api} from '../services/api';
import {useApiQuery} from '../hooks/useApiQuery';
import {useAuth} from '../hooks/useAuth';
import {useApiAction} from '../hooks/useApiAction';
import {formatRp} from '../utils/format';
import {exportToExcel, exportToPDF} from '../utils/exportUtils';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';

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
  const dialog = useA11yDialog({purpose: 'form', width: 480});
  const toast = useToast();
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  const navigate = useNavigate();
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: membersResponse, isLoading, error, refetch: fetchMembers } = useApiQuery<PaginatedResponse<MemberRow>>(`/api/members?page=${page}&limit=${limit}`);
  
  const [members, setMembers] = useState<MemberRow[]>([]);
  
  useEffect(() => {
    if (membersResponse?.data) {
      setMembers(membersResponse.data);
    }
  }, [membersResponse]);

  const handleDelete = useCallback((member: MemberRow) => {
    dialog.show(
      <Card style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        <VStack gap={4}>
          <Heading level={4}>Konfirmasi Hapus</Heading>
          <Text type="body">Apakah Anda yakin ingin menghapus anggota {member.name}?</Text>
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Batal" onClick={() => dialog.hide()} />
            <Button color="error" label="Hapus" onClick={() => {
              apiAction.execute(
                () => api.delete(`/api/members/${member.id}`),
                {
                  successMsg: 'Anggota berhasil dihapus',
                  errorMsg: 'Gagal menghapus anggota',
                  onSuccess: () => {
                    dialog.hide();
                    setTimeout(() => {
                      setMembers(members => members.filter(m => m.id !== member.id));
                    }, 100);
                  },
                  onFinally: () => dialog.hide()
                }
              );
            }} />
          </HStack>
        </VStack>
      </Card>
    );
  }, [dialog, apiAction]);

  const handleUpdateSavings = useCallback((member: MemberRow) => {
    dialog.show(
      <UpdateSavingsDialogContent 
        onClose={() => dialog.hide()}
        onSave={({ additionalSavings, savingsType, transactionDate }) => {
          apiAction.execute(
            () =>
              api.put(`/api/members/${member.id}/savings`, {
                additionalSavings,
                savingsType,
                transactionDate,
              }),
            {
              successMsg: 'Mutasi simpanan berhasil',
              errorMsg: 'Gagal melakukan mutasi simpanan',
              onSuccess: () => fetchMembers(),
              onFinally: () => dialog.hide()
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchMembers]);

  const handleShowHistory = useCallback((member: MemberRow) => {
    dialog.show(
      <TransactionHistoryDialogContent
        member={member}
        onClose={() => dialog.hide()}
      />
    );
  }, [dialog]);

  const handleEditMember = useCallback((member: MemberRow) => {
    dialog.show(
      <EditMemberDialogContent
        initialData={member}
        onClose={() => dialog.hide()}
        onEdit={(data) => {
          apiAction.execute(
            () => api.put(`/api/members/${member.id}`, data),
            {
              successMsg: 'Anggota berhasil diubah',
              errorMsg: 'Gagal mengubah anggota',
              onSuccess: () => fetchMembers(),
              onFinally: () => dialog.hide()
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchMembers]);

  const handlePortalAccess = useCallback((member: MemberRow) => {
    dialog.show(
      <PortalAccessDialogContent
        member={member}
        onClose={() => dialog.hide()}
        onSave={(payload) => {
          apiAction.execute(
            () => api.put(`/api/members/${member.id}/portal-access`, payload),
            {
              successMsg: 'Akses portal anggota diperbarui. Bagikan URL /portal ke anggota.',
              errorMsg: 'Gagal mengatur akses portal',
              onSuccess: () => fetchMembers(),
              onFinally: () => dialog.hide(),
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchMembers]);

  /** Admin opens /portal as this member (short-lived impersonation token). */
  const handlePreviewPortal = useCallback(
    (member: MemberRow) => {
      apiAction.execute(
        () =>
          api.post<{
            token: string;
            memberId: string;
            memberName: string;
            expiresIn: number;
          }>(`/api/members/${member.id}/impersonate`),
        {
          successMsg: `Pratinjau portal: ${member.name}`,
          errorMsg: 'Gagal membuka pratinjau portal',
          onSuccess: (data) => {
            // Keep admin JWT in localStorage; portal uses sessionStorage preview token
            sessionStorage.setItem('memberPreviewToken', data.token);
            sessionStorage.setItem('memberPreviewName', data.memberName || member.name);
            sessionStorage.setItem('memberPreviewReturn', '/members');
            navigate('/portal');
          },
        }
      );
    },
    [apiAction, navigate]
  );

  const columns: TableColumn<MemberRow>[] = useMemo(() => [
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
      renderCell: (item: MemberRow) => (
        <Text type="body">{item.joinDate}</Text>
      ),
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
        <HStack gap={1}>
          {hasPermission('update:members') && (
            <IconButton 
              icon={<Icon icon={PencilIcon} />} 
              label="Edit" 
              variant="ghost" 
              size="sm" 
              onClick={() => handleEditMember(item)} 
            />
          )}
          {hasPermission('read:members') && (
            <IconButton
              icon={<Icon icon={EyeIcon} />}
              label="Lihat portal anggota"
              variant="ghost"
              size="sm"
              onClick={() => handlePreviewPortal(item)}
            />
          )}
          {hasPermission('update:members') && (
            <IconButton
              icon={<Icon icon={KeyIcon} />}
              label={item.hasPortalAccess ? 'Portal aktif' : 'Akses portal'}
              variant="ghost"
              size="sm"
              onClick={() => handlePortalAccess(item)}
            />
          )}
          {hasPermission('update:savings') && (
            <IconButton 
              icon={<Icon icon={BanknotesIcon} />} 
              label="Setor" 
              variant="ghost" 
              size="sm" 
              onClick={() => handleUpdateSavings(item)} 
            />
          )}
          <IconButton 
            icon={<Icon icon={ClockIcon} />} 
            label="Riwayat" 
            variant="ghost" 
            size="sm" 
            onClick={() => handleShowHistory(item)} 
          />
          {hasPermission('delete:members') && (
            <IconButton 
              icon={<Icon icon={TrashIcon} />} 
              label="Hapus" 
              variant="ghost" 
              color="error" 
              size="sm" 
              onClick={() => handleDelete(item)} 
            />
          )}
        </HStack>
      ),
    },
  ], [hasPermission, handleEditMember, handlePreviewPortal, handlePortalAccess, handleUpdateSavings, handleShowHistory, handleDelete]);

  const filtered = useMemo(() => {
    return applyFilters(filters, members);
  }, [filters, applyFilters, members]);

  const handleAddMember = useCallback(() => {
    dialog.show(
      <AddMemberDialogContent
        onClose={() => dialog.hide()}
        onAdd={(data) => {
          apiAction.execute(
            () => api.post('/api/members', data),
            {
              successMsg: 'Anggota berhasil ditambahkan',
              errorMsg: 'Gagal menambahkan anggota',
              onSuccess: () => fetchMembers(),
              onFinally: () => dialog.hide()
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchMembers]);

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
            {hasPermission('export:reports') && (
              <>
                <IconButton
                  label="Unduh"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={() => {
                    if (members.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
                    const columns = [
                      { header: 'Nama', key: 'name' },
                      { header: 'Jabatan', key: 'role' },
                      { header: 'Status', key: 'status' },
                      { header: 'Tanggal Gabung', key: 'joinDate' },
                      { header: 'Simpanan Pokok', key: 'simpananPokok', render: (item: any) => formatRp(item.simpananPokok) },
                      { header: 'Simpanan Wajib', key: 'simpananWajib', render: (item: any) => formatRp(item.simpananWajib) },
                      { header: 'Simpanan Sukarela', key: 'simpananSukarela', render: (item: any) => formatRp(item.simpananSukarela) },
                      { header: 'Total Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) }
                    ];
                    exportToExcel(members, columns, `Data_Anggota_${new Date().toISOString().slice(0,10)}`);
                  }}
                />
                <IconButton
                  label="Cetak PDF"
                  icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                  variant="ghost"
                  onClick={() => {
                    if (members.length === 0) {
                      toast.show({ type: 'error', message: 'Data kosong' });
                      return;
                    }
                    const columns = [
                      { header: 'Nama', key: 'name' },
                      { header: 'Status', key: 'status' },
                      { header: 'Tanggal Gabung', key: 'joinDate' },
                      { header: 'Simpanan Pokok', key: 'simpananPokok', render: (item: any) => formatRp(item.simpananPokok) },
                      { header: 'Simpanan Wajib', key: 'simpananWajib', render: (item: any) => formatRp(item.simpananWajib) },
                      { header: 'Total Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) }
                    ];
                    exportToPDF(members, columns, `Laporan_Anggota_${new Date().toISOString().slice(0,10)}`, 'DAFTAR ANGGOTA KOPERASI');
                  }}
                />
              </>
            )}
            {hasPermission('create:members') && (
              <Button
                label="Tambah Anggota"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={handleAddMember}
              />
            )}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchMembers} errorTitle="Gagal Memuat Data Anggota">
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
            <Pagination
              page={membersResponse?.page || 1}
              limit={membersResponse?.limit || limit}
              total={membersResponse?.total || 0}
              onPageChange={setPage}
            />
          </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
    {dialog.element}
    </>
  );
}
