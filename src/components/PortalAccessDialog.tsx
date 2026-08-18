'use client';

import {useState, useEffect} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import type {MemberRow} from '../shared/types';

export type PortalAccessPayload = {
  email?: string;
  password?: string;
};

export function PortalAccessDialogContent({
  member,
  onClose,
  onSave,
}: {
  member: MemberRow;
  onClose: () => void;
  onSave: (payload: PortalAccessPayload) => void;
}) {
  const [email, setEmail] = useState(member.email || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setEmail(member.email || '');
    setPassword('');
    setPasswordConfirm('');
    setLocalError('');
  }, [member]);

  const handleSave = () => {
    setLocalError('');
    const emailTrim = email.trim();
    if (!emailTrim && !password) {
      setLocalError('Isi email dan/atau password.');
      return;
    }
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setLocalError('Format email tidak valid.');
      return;
    }
    if (password) {
      if (password.length < 8) {
        setLocalError('Password minimal 8 karakter.');
        return;
      }
      if (password !== passwordConfirm) {
        setLocalError('Konfirmasi password tidak cocok.');
        return;
      }
      if (!emailTrim && !member.email) {
        setLocalError('Email wajib diisi saat mengaktifkan password portal.');
        return;
      }
    }

    onSave({
      ...(emailTrim ? {email: emailTrim} : email === '' && member.email ? {email: ''} : {}),
      ...(password ? {password} : {}),
    });
  };

  return (
    <VStack padding={4} gap={4} style={{width: '100%', boxSizing: 'border-box'}}>
      <VStack gap={1}>
        <Heading level={3}>Akses Portal Anggota</Heading>
        <Text type="supporting" color="secondary">
          Aktifkan login di /portal untuk {member.name}. Anggota dapat masuk dengan password atau
          Google (email Google harus sama dengan email portal di bawah).
        </Text>
        {member.hasPortalAccess && (
          <Text type="supporting" color="secondary">
            Status: portal sudah aktif{member.email ? ` (${member.email})` : ''}.
          </Text>
        )}
      </VStack>

      <VStack gap={3}>
        <TextInput
          label="Email Portal"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="anggota@email.com"
          description="Bisa juga login dengan ID anggota setelah password di-set"
        />
        <TextInput
          label="Password Baru"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={member.hasPortalAccess ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}
          description={member.hasPortalAccess ? 'Isi hanya jika ingin mengganti password' : 'Wajib untuk aktivasi pertama'}
        />
        <TextInput
          label="Konfirmasi Password"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          placeholder="Ulangi password baru"
        />
        {localError ? (
          <Text type="supporting" color="accent">
            {localError}
          </Text>
        ) : null}
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan Akses Portal" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
