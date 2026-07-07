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

export function AddMemberDialogContent({onClose, onAdd}: {onClose: () => void, onAdd: (m: any) => void}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Anggota');
  const [deposit, setDeposit] = useState('500000');

  const handleSave = () => {
    onAdd({
      name,
      role,
      status: 'Aktif',
      joinDate: new Date().toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'}),
      totalSavings: parseInt(deposit, 10) || 0,
    });
    onClose();
  };

  return (
    <Layout
      header={
        <DialogHeader
          title="Tambah Anggota Baru"
          subtitle="Masukkan data pendaftaran anggota koperasi"
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
              label="Setoran Awal (Simpanan Pokok) (Rp)"
              value={deposit}
              onChange={setDeposit}
              type="number"
              placeholder="Contoh: 500000"
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Batal" variant="secondary" onClick={onClose} />
            <Button label="Simpan Data" variant="primary" onClick={handleSave} disabled={!name} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
