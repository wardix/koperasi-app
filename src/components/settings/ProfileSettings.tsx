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
  coopBankName: string;
  coopBankAccountNumber: string;
  coopBankAccountName: string;
  canUpdate: boolean;
  onKoperasiNameChange: (v: string) => void;
  onAlamatChange: (v: string) => void;
  onTeleponChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onCoopBankNameChange: (v: string) => void;
  onCoopBankAccountNumberChange: (v: string) => void;
  onCoopBankAccountNameChange: (v: string) => void;
  onSave: () => void;
}

/**
 * Koperasi profile fields: name, address, phone, email, and official bank account.
 * Controlled component — all state lives in parent (Settings.tsx).
 */
export function ProfileSettings({
  koperasiName,
  alamat,
  telepon,
  email,
  coopBankName,
  coopBankAccountNumber,
  coopBankAccountName,
  canUpdate,
  onKoperasiNameChange,
  onAlamatChange,
  onTeleponChange,
  onEmailChange,
  onCoopBankNameChange,
  onCoopBankAccountNumberChange,
  onCoopBankAccountNameChange,
  onSave,
}: ProfileSettingsProps) {
  return (
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Informasi Koperasi</Heading>
        <Text type="supporting" color="secondary">
          Perbarui detail identitas dan rekening bank resmi koperasi Anda.
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

        <VStack gap={1} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-primary, #e5e7eb)' }}>
          <Text type="body" weight="bold">Rekening Bank Resmi Koperasi (Tujuan Transfer Simpanan)</Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 13 }}>
            Informasi rekening resmi ini akan ditampilkan secara otomatis pada formulir konfirmasi setoran transfer di portal anggota.
          </Text>
        </VStack>

        <Grid columns={2} gap={4}>
          <TextInput
            label="Nama Bank"
            value={coopBankName}
            onChange={onCoopBankNameChange}
            placeholder="Bank Mandiri"
            disabled={!canUpdate}
          />
          <TextInput
            label="Nomor Rekening"
            value={coopBankAccountNumber}
            onChange={onCoopBankAccountNumberChange}
            placeholder="1060022716008"
            disabled={!canUpdate}
          />
        </Grid>
        <TextInput
          label="Nama Pemilik Rekening (a.n.)"
          value={coopBankAccountName}
          onChange={onCoopBankAccountNameChange}
          placeholder="Koperasi Jasa Nusa Sejahtera Prima"
          disabled={!canUpdate}
        />

        {canUpdate && (
          <HStack hAlign="start" style={{ marginTop: 8 }}>
            <Button label="Simpan Perubahan" variant="primary" onClick={onSave} />
          </HStack>
        )}
      </VStack>
    </Grid>
  );
}
