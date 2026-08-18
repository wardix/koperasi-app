// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useState, useEffect, useCallback} from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {ArrowDownTrayIcon, PlusIcon} from '@heroicons/react/24/outline';
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
import {exportToExcel} from '../utils/exportUtils';
import {Pagination} from '../components/Pagination';
import {DataStateView} from '../components/DataStateView';

import {ImportMembersDialogContent} from '../components/ImportMembersDialog';
import {MembersList} from '../components/members/MembersList';

import type {MemberRow, PaginatedResponse} from '../shared/types';

const statusOptions = [
  {value: '', label: 'Semua Status'},
  {value: 'Aktif', label: 'Aktif'},
  {value: 'Pasif', label: 'Pasif'},
];

const roleOptions = [
  {value: '', label: 'Semua Jabatan'},
  {value: 'Anggota', label: 'Anggota'},
  {value: 'Ketua', label: 'Ketua'},
  {value: 'Bendahara', label: 'Bendahara'},
  {value: 'Sekretaris', label: 'Sekretaris'},
];

export default function MembersTemplate() {
  const dialog = useA11yDialog({purpose: 'form', width: 480});
  const toast = useToast();
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, roleFilter]);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (roleFilter) queryParams.set('role', roleFilter);

  const { data: membersResponse, isLoading, error, refetch: fetchMembers } = useApiQuery<PaginatedResponse<MemberRow>>(`/api/members?${queryParams.toString()}`);
  
  const members = membersResponse?.data || [];

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
        key={`update-savings-${member.id}`}
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
        key={`history-${member.id}`}
        member={member}
        onClose={() => dialog.hide()}
      />
    );
  }, [dialog]);

  const handleEditMember = useCallback((member: MemberRow) => {
    dialog.show(
      <EditMemberDialogContent
        key={`edit-${member.id}`}
        initialData={member}
        onClose={() => dialog.hide()}
        onEdit={(data) => {
          apiAction.execute(
            () =>
              api.put(`/api/members/${member.id}`, {
                name: data.name,
                role: data.role,
                status: data.status,
                joinDate: data.joinDate,
                nik: data.nik ?? null,
                phone: data.phone ?? null,
                simpananPokok: data.simpananPokok,
                simpananWajib: data.simpananWajib,
                simpananSukarela: data.simpananSukarela,
              }),
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
        key={`portal-access-${member.id}`}
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



  const handleImportMembers = useCallback(() => {
    dialog.show(
      <ImportMembersDialogContent
        onClose={() => dialog.hide()}
        onSuccess={() => fetchMembers()}
      />
    );
  }, [dialog, fetchMembers]);

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
            {hasPermission('export:reports') && (
              <IconButton
                label="Unduh"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                variant="ghost"
                onClick={() => {
                  if (members.length === 0) {
                    toast.show({ type: 'error', message: 'Data kosong' });
                    return;
                  }
                  
                  const exportParams = new URLSearchParams();
                  exportParams.set('all', 'true');
                  if (debouncedSearch) exportParams.set('search', debouncedSearch);
                  if (statusFilter) exportParams.set('status', statusFilter);
                  if (roleFilter) exportParams.set('role', roleFilter);

                  apiAction.execute(
                    () => api.get<PaginatedResponse<MemberRow>>(`/api/members?${exportParams.toString()}`),
                    {
                      successMsg: 'Data Excel berhasil diunduh',
                      errorMsg: 'Gagal menyiapkan data unduhan',
                      onSuccess: (res) => {
                        const allMembers = res.data || [];
                        const columns = [
                          { header: 'Nama', key: 'name' },
                          { header: 'NIK', key: 'nik' },
                          { header: 'Telepon', key: 'phone' },
                          { header: 'Jabatan', key: 'role' },
                          { header: 'Status', key: 'status' },
                          { header: 'Tanggal Gabung', key: 'joinDate' },
                          { header: 'Simpanan Pokok', key: 'simpananPokok', render: (item: any) => formatRp(item.simpananPokok) },
                          { header: 'Simpanan Wajib', key: 'simpananWajib', render: (item: any) => formatRp(item.simpananWajib) },
                          { header: 'Simpanan Sukarela', key: 'simpananSukarela', render: (item: any) => formatRp(item.simpananSukarela) },
                          { header: 'Total Simpanan', key: 'totalSavings', render: (item: any) => formatRp(item.totalSavings) }
                        ];
                        exportToExcel(allMembers, columns, `Data_Anggota_${new Date().toISOString().slice(0,10)}`);
                      }
                    }
                  );
                }}
              />
            )}

            {hasPermission('create:members') && (
              <Button
                label="Import Anggota (CSV)"
                icon={<Icon icon={ArrowDownTrayIcon} size="sm" />}
                variant="secondary"
                onClick={handleImportMembers}
              />
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
              <HStack gap={3} vAlign="center" style={{ width: '100%' }}>
              <StackItem size="fill">
                <TextInput
                  placeholder="Cari nama, NIK, atau no. telepon..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </StackItem>
              <StackItem style={{ width: '160px' }}>
                <Selector
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                />
              </StackItem>
              <StackItem style={{ width: '180px' }}>
                <Selector
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleOptions}
                />
              </StackItem>
            </HStack>
            <MembersList
              members={members}
              permissions={{
                canUpdate: hasPermission('update:members'),
                canRead: hasPermission('read:members'),
                canUpdateSavings: hasPermission('update:savings'),
                canDelete: hasPermission('delete:members'),
              }}
              onEdit={handleEditMember}
              onPreviewPortal={handlePreviewPortal}
              onPortalAccess={handlePortalAccess}
              onUpdateSavings={handleUpdateSavings}
              onShowHistory={handleShowHistory}
              onDelete={handleDelete}
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
