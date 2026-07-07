'use client';

import {useState} from 'react';
import {DialogHeader} from '@astryxdesign/core/Dialog';
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  HStack,
  VStack,
} from '@astryxdesign/core/Layout';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import type {MemberRow} from '../shared/types';

export function EditMemberDialogContent({
  onClose,
  onEdit,
  initialData,
}: {
  onClose: () => void;
  onEdit: (m: MemberRow) => void;
  initialData: MemberRow;
}) {
  const [name, setName] = useState(initialData.name);
  const [role, setRole] = useState(initialData.role);
  const [status, setStatus] = useState(initialData.status);
  const [simpananPokok, setSimpananPokok] = useState(String(initialData.simpananPokok ?? 0));
  const [simpananWajib, setSimpananWajib] = useState(String(initialData.simpananWajib ?? 0));
  const [simpananSukarela, setSimpananSukarela] = useState(String(initialData.simpananSukarela ?? 0));

  const handleSave = () => {
    onEdit({
      ...initialData,
      name,
      role,
      status,
      simpananPokok: parseInt(simpananPokok, 10) || 0,
      simpananWajib: parseInt(simpananWajib, 10) || 0,
      simpananSukarela: parseInt(simpananSukarela, 10) || 0,
    });
    onClose();
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Edit Anggota"
          subtitle={`Ubah data untuk ${initialData.name}`}
          onOpenChange={() => onClose()}
        />
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            <TextInput
              label="Nama Lengkap"
              value={name}
              onChange={setName}
              placeholder="Contoh: Budi Santoso"
            />
            <TextInput
              label="Jabatan"
              value={role}
              onChange={setRole}
              placeholder="Contoh: Anggota, Pengurus"
            />
            <TextInput
              label="Status"
              value={status}
              onChange={setStatus}
              placeholder="Aktif / Pasif"
            />
            <TextInput
              label="Simpanan Pokok (Rp)"
              value={simpananPokok}
              onChange={setSimpananPokok}
              type="number"
            />
            <TextInput
              label="Simpanan Wajib (Rp)"
              value={simpananWajib}
              onChange={setSimpananWajib}
              type="number"
            />
            <TextInput
              label="Simpanan Sukarela (Rp)"
              value={simpananSukarela}
              onChange={setSimpananSukarela}
              type="number"
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button label="Simpan Perubahan" variant="primary" onClick={handleSave} disabled={!name} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
