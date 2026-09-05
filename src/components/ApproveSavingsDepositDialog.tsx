import React, { useState, useEffect } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import type { SavingsDepositRow } from '../shared/types';

interface Props {
  deposit: SavingsDepositRow;
  onClose: () => void;
  onConfirm: (payload: { paymentTargetAccountId?: string }) => Promise<void> | void;
  isLoading?: boolean;
}

export function ApproveSavingsDepositDialogContent({
  deposit,
  onClose,
  onConfirm,
  isLoading = false,
}: Props) {
  const { data: paymentSourcesRes } = useApiQuery<{
    success: boolean;
    data: Array<{ id: string; code: string; name: string; type: string }>;
  }>('/api/savings/payment-sources');

  const paymentSources = paymentSourcesRes?.data || [];
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    if (!selectedAccountId && paymentSources.length > 0) {
      // Default to 11102 (Bank Mandiri)
      const mandiri = paymentSources.find((a) => a.code === '11102');
      if (mandiri) setSelectedAccountId(mandiri.id);
      else setSelectedAccountId(paymentSources[0].id);
    }
  }, [paymentSources, selectedAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      paymentTargetAccountId: selectedAccountId || undefined,
    });
  };

  const getSavingsTypeLabel = (type: string) => {
    switch (type) {
      case 'pokok':
        return 'Simpanan Pokok';
      case 'wajib':
        return 'Simpanan Wajib';
      case 'sukarela':
        return 'Simpanan Sukarela';
      default:
        return type;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack padding={4} gap={4}>
        <VStack gap={1}>
          <Heading level={3}>Verifikasi Setoran Simpanan</Heading>
          <Text type="supporting" color="secondary">
            Persetujuan akan memverifikasi setoran transfer anggota, menambah saldo simpanan anggota terkait, dan membukukan mutasi penerimaan kas/bank secara otomatis.
          </Text>
        </VStack>

        <VStack
          gap={2}
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-background-secondary, #f9fafb)',
            borderRadius: 8,
            border: '1px solid var(--color-border-primary, #e5e7eb)',
          }}
        >
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Anggota:</Text>
            <Text type="body" weight="semibold">{deposit.memberName || 'Anggota Koperasi'}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Jenis Simpanan:</Text>
            <Text type="body" weight="semibold" color="primary">
              {getSavingsTypeLabel(deposit.savingsType)}
            </Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Nominal Setoran:</Text>
            <Text type="body" weight="bold" color="primary">{formatRp(deposit.amount)}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Tanggal Transfer:</Text>
            <Text type="body" weight="medium">{deposit.transferDate}</Text>
          </HStack>
          {(deposit.senderBank || deposit.senderAccount || deposit.senderName) && (
            <HStack justify="space-between" vAlign="center">
              <Text type="supporting" color="secondary">Rekening Pengirim:</Text>
              <Text type="body" weight="medium">
                {deposit.senderBank || '-'} {deposit.senderAccount ? `(${deposit.senderAccount})` : ''}{' '}
                {deposit.senderName ? `a.n. ${deposit.senderName}` : ''}
              </Text>
            </HStack>
          )}
          {deposit.proofUrl && (
            <HStack justify="space-between" vAlign="center">
              <Text type="supporting" color="secondary">Bukti Transfer:</Text>
              <a
                href={deposit.proofUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--color-primary-600, #2563eb)',
                  textDecoration: 'underline',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Lihat Bukti Transfer {deposit.proofName ? `(${deposit.proofName})` : '↗'}
              </a>
            </HStack>
          )}
          {deposit.notes && (
            <HStack justify="space-between" vAlign="flex-start">
              <Text type="supporting" color="secondary">Catatan:</Text>
              <Text type="supporting" style={{ maxWidth: 300, textAlign: 'right' }}>{deposit.notes}</Text>
            </HStack>
          )}
        </VStack>

        <VStack gap={2}>
          <label htmlFor="target-account" style={{ fontSize: 14, fontWeight: 600 }}>
            Rekening Kas / Bank Penerima Setoran
          </label>
          <select
            id="target-account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border-primary, #e5e7eb)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #111827)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          >
            {paymentSources.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.code})
              </option>
            ))}
            {paymentSources.length === 0 && (
              <>
                <option value="ed0ad424-aff5-4a79-8fa2-24eaa541d6fc">Bank Mandiri (11102)</option>
                <option value="64fa79d2-cd8f-414a-80ac-7daae0e3fd1f">Kas Kecil (11101)</option>
              </>
            )}
          </select>
        </VStack>

        <HStack justify="flex-end" gap={2} style={{ marginTop: 8 }}>
          <Button label="Batal" variant="ghost" onClick={onClose} isDisabled={isLoading} />
          <Button
            label={isLoading ? 'Memproses...' : 'Verifikasi & Bukukan'}
            variant="primary"
            type="submit"
            isDisabled={isLoading}
          />
        </HStack>
      </VStack>
    </form>
  );
}
