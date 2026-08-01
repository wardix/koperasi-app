'use client';

import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';

interface ProfileSettingsProps {
  koperasiName: string;
  alamat: string;
  telepon: string;
  email: string;
  canUpdate: boolean;
  onKoperasiNameChange: (v: string) => void;
  onAlamatChange: (v: string) => void;
  onTeleponChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSave: () => void;
}

/**
 * Koperasi profile fields: name, address, phone, email.
 * Controlled component — all state lives in parent (Settings.tsx).
 */
export function ProfileSettings({
  koperasiName,
  alamat,
  telepon,
  email,
  canUpdate,
  onKoperasiNameChange,
  onAlamatChange,
  onTeleponChange,
  onEmailChange,
  onSave,
}: ProfileSettingsProps) {
  return (
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Informasi Koperasi</Heading>
        <Text type="supporting" color="secondary">
          Perbarui detail dan identitas koperasi Anda.
        </Text>
      </VStack>
      <VStack gap={4}>
        <TextInput
          label="Nama Koperasi"
          value={koperasiName}
          onChange={onKoperasiNameChange}
          disabled={!canUpdate}
        />
        <TextInput
          label="Alamat Lengkap"
          value={alamat}
          onChange={onAlamatChange}
          disabled={!canUpdate}
        />
        <Grid columns={2} gap={4}>
          <TextInput
            label="No. Telepon"
            value={telepon}
            onChange={onTeleponChange}
            disabled={!canUpdate}
          />
          <TextInput
            label="Email Resmi"
            type="email"
            value={email}
            onChange={onEmailChange}
            disabled={!canUpdate}
          />
        </Grid>
        {canUpdate && (
          <HStack hAlign="start">
            <Button label="Simpan Perubahan" variant="primary" onClick={onSave} />
          </HStack>
        )}
      </VStack>
    </Grid>
  );
}
