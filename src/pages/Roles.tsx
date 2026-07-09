'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutFooter,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import {
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useA11yDialog } from '../hooks/useA11yDialog';
import { useToast } from '@astryxdesign/core/Toast';
import { api } from '../services/api';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../hooks/useAuth';
import { useApiAction } from '../hooks/useApiAction';
import { DataStateView } from '../components/DataStateView';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { DialogHeader } from '@astryxdesign/core/Dialog';

interface AdminRow {
  id: string;
  email: string;
  role: 'viewer' | 'admin' | 'superadmin';
  name?: string;
  avatar_url?: string;
  auth_provider: 'local' | 'google';
}

// Dialog: Add Admin
function AddAdminDialogContent({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { email: string; name: string; role: string; password?: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('viewer');
  const [password, setPassword] = useState('');
  const [authType, setAuthType] = useState<'local' | 'google'>('local');

  const handleSave = () => {
    onSave({
      email,
      name,
      role,
      password: authType === 'local' ? password : '',
    });
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Tambah Pengurus Baru"
          subtitle="Undang atau tambahkan pengurus koperasi baru"
          onOpenChange={onClose}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            <TextInput
              label="Nama Lengkap"
              value={name}
              onChange={setName}
              placeholder="Contoh: Admin Koperasi"
            />
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="name@example.com"
            />
            <Selector
              label="Metode Autentikasi"
              value={authType}
              onChange={(val) => setAuthType(val as 'local' | 'google')}
              options={[
                { value: 'local', label: 'Password Lokal' },
                { value: 'google', label: 'Google Single Sign-On (SSO)' },
              ]}
            />
            {authType === 'local' && (
              <TextInput
                label="Password Awal"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Minimal 6 karakter"
              />
            )}
            <Selector
              label="Peran / Hak Akses"
              value={role}
              onChange={setRole}
              options={[
                { value: 'viewer', label: 'Viewer / Pengawas (Hanya baca data)' },
                { value: 'admin', label: 'Admin (Operasional, tanpa hapus/settings)' },
                { value: 'superadmin', label: 'Superadmin (Akses penuh + konfigurasi)' },
              ]}
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button
              label="Simpan Pengurus"
              variant="primary"
              onClick={handleSave}
              disabled={!email || (authType === 'local' && password.length < 6)}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

// Dialog: Edit Admin Role
function EditAdminRoleDialogContent({
  admin,
  onClose,
  onSave,
}: {
  admin: AdminRow;
  onClose: () => void;
  onSave: (role: string) => void;
}) {
  const [role, setRole] = useState(admin.role);

  return (
    <Layout
      header={
        <DialogHeader
          title="Ubah Peran Pengurus"
          subtitle={`Ubah hak akses untuk pengurus ${admin.name || admin.email}`}
          onOpenChange={onClose}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            <Selector
              label="Peran / Hak Akses"
              value={role}
              onChange={setRole}
              options={[
                { value: 'viewer', label: 'Viewer / Pengawas (Hanya baca data)' },
                { value: 'admin', label: 'Admin (Operasional, tanpa hapus/settings)' },
                { value: 'superadmin', label: 'Superadmin (Akses penuh + konfigurasi)' },
              ]}
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button label="Simpan Perubahan" variant="primary" onClick={() => onSave(role)} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

export default function RolesTemplate() {
  const dialog = useA11yDialog({ purpose: 'form', width: 480 });
  const toast = useToast();
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();

  const { data: adminsResponse, isLoading, error, refetch: fetchAdmins } = useApiQuery<AdminRow[]>('/api/admins');
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  useEffect(() => {
    if (adminsResponse) {
      setAdmins(adminsResponse);
    }
  }, [adminsResponse]);

  const handleAddAdmin = useCallback(() => {
    dialog.show(
      <AddAdminDialogContent
        onClose={() => dialog.hide()}
        onSave={(data) => {
          apiAction.execute(
            () => api.post('/api/admins', data),
            {
              successMsg: 'Pengurus berhasil ditambahkan',
              errorMsg: 'Gagal menambahkan pengurus',
              onSuccess: () => fetchAdmins(),
              onFinally: () => dialog.hide()
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchAdmins]);

  const handleEditRole = useCallback((admin: AdminRow) => {
    dialog.show(
      <EditAdminRoleDialogContent
        admin={admin}
        onClose={() => dialog.hide()}
        onSave={(role) => {
          apiAction.execute(
            () => api.put(`/api/admins/${admin.id}`, { role }),
            {
              successMsg: 'Peran pengurus berhasil diperbarui',
              errorMsg: 'Gagal memperbarui peran pengurus',
              onSuccess: () => fetchAdmins(),
              onFinally: () => dialog.hide()
            }
          );
        }}
      />
    );
  }, [dialog, apiAction, fetchAdmins]);

  const handleDeleteAdmin = useCallback((admin: AdminRow) => {
    dialog.show(
      <Card style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        <VStack gap={4}>
          <Heading level={4}>Konfirmasi Hapus</Heading>
          <Text type="body">Apakah Anda yakin ingin menghapus pengurus {admin.name || admin.email}?</Text>
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Batal" onClick={() => dialog.hide()} />
            <Button
              color="error"
              label="Hapus"
              onClick={() => {
                apiAction.execute(
                  () => api.delete(`/api/admins/${admin.id}`),
                  {
                    successMsg: 'Pengurus berhasil dihapus',
                    errorMsg: 'Gagal menghapus pengurus',
                    onSuccess: () => fetchAdmins(),
                    onFinally: () => dialog.hide()
                  }
                );
              }}
            />
          </HStack>
        </VStack>
      </Card>
    );
  }, [dialog, apiAction, fetchAdmins]);

  const columns: TableColumn<AdminRow>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nama',
      width: proportional(1.5),
      renderCell: (item: AdminRow) => (
        <HStack gap={2} vAlign="center">
          <Avatar size="sm" name={item.name || item.email} src={item.avatar_url} />
          <VStack>
            <Text type="body" weight="medium">{item.name || 'Pengurus Koperasi'}</Text>
            <Text type="supporting" color="secondary" size="xs">{item.email}</Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: 'role',
      header: 'Peran / Hak Akses',
      width: proportional(1.2),
      renderCell: (item: AdminRow) => {
        let label = 'Viewer';
        let variant: 'neutral' | 'success' | 'warning' = 'neutral';
        if (item.role === 'superadmin') {
          label = 'Superadmin';
          variant = 'success';
        } else if (item.role === 'admin') {
          label = 'Admin';
          variant = 'warning';
        }
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'auth_provider',
      header: 'Metode Login',
      width: proportional(1.2),
      renderCell: (item: AdminRow) => {
        const isGoogle = item.auth_provider === 'google';
        return (
          <HStack gap={1} vAlign="center">
            <Icon icon={isGoogle ? ShieldCheckIcon : LockClosedIcon} size="sm" />
            <Text type="body" size="sm">
              {isGoogle ? 'Google SSO' : 'Lokal (Password)'}
            </Text>
          </HStack>
        );
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(100),
      renderCell: (item: AdminRow) => (
        <HStack gap={1}>
          {hasPermission('manage:users') && (
            <>
              <IconButton
                icon={<Icon icon={PencilIcon} />}
                label="Ubah Peran"
                variant="ghost"
                size="sm"
                onClick={() => handleEditRole(item)}
              />
              <IconButton
                icon={<Icon icon={TrashIcon} />}
                label="Hapus"
                variant="ghost"
                color="error"
                size="sm"
                onClick={() => handleDeleteAdmin(item)}
              />
            </>
          )}
        </HStack>
      ),
    },
  ], [hasPermission, handleEditRole, handleDeleteAdmin]);

  // Deny access if not superadmin / manage:users
  if (!isLoading && !hasPermission('manage:users')) {
    return (
      <Center height="100%">
        <Card style={{ padding: '32px', maxWidth: '400px', textAlign: 'center' }}>
          <VStack gap={4} hAlign="center">
            <Heading level={2}>Akses Ditolak</Heading>
            <Text type="body" color="secondary">
              Anda tidak memiliki izin (Superadmin) untuk mengakses halaman Manajemen Peran & Akses.
            </Text>
          </VStack>
        </Card>
      </Center>
    );
  }

  return (
    <>
      <Layout
        height="auto"
        header={
          <LayoutHeader hasDivider>
            <HStack gap={2} vAlign="center">
              <StackItem size="fill">
                <Heading level={1}>Manajemen Peran & Akses</Heading>
              </StackItem>
              {hasPermission('manage:users') && (
                <Button
                  label="Tambah Pengurus"
                  icon={<Icon icon={UserPlusIcon} size="sm" />}
                  onClick={handleAddAdmin}
                />
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={3}>
            <DataStateView
              isLoading={isLoading}
              error={error}
              onRetry={fetchAdmins}
              errorTitle="Gagal Memuat Daftar Pengurus"
            >
              <VStack gap={4}>
                <Table<AdminRow>
                  data={admins}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
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
