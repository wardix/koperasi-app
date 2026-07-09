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

import type { MemberRow } from '../shared/types';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatJoinDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
}

export function AddMemberDialogContent({onClose, onAdd}: {onClose: () => void, onAdd: (m: Omit<MemberRow, 'id' | 'simpananWajib' | 'simpananSukarela' | 'totalSavings'>) => void}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Anggota');
  const [deposit, setDeposit] = useState('500000');
  const [joinDate, setJoinDate] = useState(todayISO());

  const handleSave = () => {
    onAdd({
      name,
      role,
      status: 'Aktif',
      joinDate: formatJoinDate(joinDate),
      simpananPokok: parseInt(deposit, 10) || 0,
      simpananWajib: 0,
      simpananSukarela: 0,
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
              label="Tanggal Bergabung"
              value={joinDate}
              onChange={setJoinDate}
              type="date"
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

