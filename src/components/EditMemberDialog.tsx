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
import {Text} from '@astryxdesign/core/Text';
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
  const [nik, setNik] = useState(initialData.nik || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [role, setRole] = useState(initialData.role);
  const [status, setStatus] = useState(initialData.status);
  const [localError, setLocalError] = useState('');

  const handleSave = () => {
    setLocalError('');
    const nikDigits = nik.replace(/\D/g, '');
    if (nikDigits && nikDigits.length !== 16) {
      setLocalError('NIK harus 16 digit angka (atau kosongkan).');
      return;
    }
    const phoneTrim = phone.trim();
    const phoneHasPlus = phoneTrim.startsWith('+');
    const phoneDigits = phoneTrim.replace(/\D/g, '');
    const phoneNorm = !phoneDigits ? '' : phoneHasPlus ? `+${phoneDigits}` : phoneDigits;
    if (phoneNorm) {
      const n = phoneNorm.replace(/\D/g, '').length;
      if (n < 8 || n > 15) {
        setLocalError('Nomor telepon harus 8–15 digit (atau kosongkan).');
        return;
      }
    }
    if (!name.trim()) {
      setLocalError('Nama wajib diisi.');
      return;
    }
    onEdit({
      ...initialData,
      name: name.trim(),
      nik: nikDigits || null,
      phone: phoneNorm || null,
      role,
      status,
      simpananPokok: initialData.simpananPokok,
      simpananWajib: initialData.simpananWajib,
      simpananSukarela: initialData.simpananSukarela,
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
              label="NIK"
              value={nik}
              onChange={(raw) => setNik(raw.replace(/\D/g, '').slice(0, 16))}
              placeholder="16 digit NIK (opsional)"
              description="Nomor Induk Kependudukan — unik per anggota"
              type="text"
            />
            <TextInput
              label="Nomor Telepon"
              value={phone}
              onChange={(raw) => {
                let s = raw.replace(/[^\d+]/g, '');
                if (s.includes('+')) {
                  s = '+' + s.replace(/\+/g, '').replace(/\D/g, '');
                } else {
                  s = s.replace(/\D/g, '');
                }
                setPhone(s.slice(0, 16));
              }}
              placeholder="Contoh: 081234567890"
              description="Opsional — 8–15 digit, boleh diawali +"
              type="text"
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
            {localError ? (
              <Text type="supporting" color="critical">
                {localError}
              </Text>
            ) : null}
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
