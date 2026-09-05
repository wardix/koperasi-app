'use client';

import { useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';
import { useToast } from '@astryxdesign/core/Toast';
import { api } from '../../services/api';

interface WaNotificationSettingsProps {
  waNotificationEnabled: boolean;
  waWebhookUrl: string;
  waWebhookToken: string;
  waNotificationTarget: string;
  canUpdate: boolean;
  onWaNotificationEnabledChange: (v: boolean) => void;
  onWaWebhookUrlChange: (v: string) => void;
  onWaWebhookTokenChange: (v: string) => void;
  onWaNotificationTargetChange: (v: string) => void;
  onSave: () => void;
}

/**
 * WhatsApp webhook notification configuration.
 * Allows administrators to configure gateway URL, auth token, and recipient number.
 */
export function WaNotificationSettings({
  waNotificationEnabled,
  waWebhookUrl,
  waWebhookToken,
  waNotificationTarget,
  canUpdate,
  onWaNotificationEnabledChange,
  onWaWebhookUrlChange,
  onWaWebhookTokenChange,
  onWaNotificationTargetChange,
  onSave,
}: WaNotificationSettingsProps) {
  const [isTesting, setIsTesting] = useState(false);
  const toast = useToast();

  const handleTestNotification = async () => {
    if (!waWebhookUrl) {
      toast({ body: 'Silakan isi URL Webhook terlebih dahulu', type: 'error' });
      return;
    }
    if (!waNotificationTarget) {
      toast({ body: 'Silakan isi Nomor WhatsApp Tujuan terlebih dahulu', type: 'error' });
      return;
    }

    setIsTesting(true);
    try {
      const res = await api.post('/api/settings/test-wa', {
        webhookUrl: waWebhookUrl,
        token: waWebhookToken,
        target: waNotificationTarget,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ body: data.message || 'Pesan uji coba berhasil dikirim!', type: 'info' });
      } else {
        toast({ body: data.message || 'Gagal mengirim pesan uji coba', type: 'error' });
      }
    } catch (err: any) {
      toast({ body: err?.message || 'Gagal terhubung ke server', type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Notifikasi WhatsApp</Heading>
        <Text type="supporting" color="secondary">
          Konfigurasi gateway pesan WhatsApp untuk memberitahu pengurus secara instan saat anggota mengajukan kasbon EWA, penarikan simpanan, atau pinjaman.
        </Text>
      </VStack>

      <VStack gap={4}>
        <CheckboxInput
          label="Aktifkan Notifikasi WhatsApp"
          description="Kirim pesan otomatis ke pengurus setiap kali ada pengajuan yang membutuhkan tindak lanjut."
          value={waNotificationEnabled}
          onChange={onWaNotificationEnabledChange}
          disabled={!canUpdate}
        />

        <TextInput
          label="URL Webhook Gateway"
          placeholder="https://api.gateway.example/v2/messages"
          value={waWebhookUrl}
          onChange={onWaWebhookUrlChange}
          disabled={!canUpdate}
        />

        <TextInput
          label="Bearer Token"
          type="password"
          placeholder="Masukkan token otentikasi API..."
          value={waWebhookToken}
          onChange={onWaWebhookTokenChange}
          disabled={!canUpdate}
        />

        <TextInput
          label="Nomor WhatsApp Pengurus / Grup"
          placeholder="Contoh: 6281234567890"
          value={waNotificationTarget}
          onChange={onWaNotificationTargetChange}
          disabled={!canUpdate}
        />

        {canUpdate && (
          <HStack gap={3}>
            <Button
              label={isTesting ? 'Mengirim Uji Coba...' : 'Kirim Pesan Uji Coba'}
              variant="secondary"
              onClick={handleTestNotification}
              disabled={isTesting}
            />
            <Button
              label="Simpan Notifikasi"
              variant="primary"
              onClick={onSave}
            />
          </HStack>
        )}
      </VStack>
    </Grid>
  );
}
