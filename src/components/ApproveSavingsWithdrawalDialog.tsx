import React, { useState, useEffect } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import type { SavingsWithdrawalRow } from '../shared/types';

interface Props {
  withdrawal: SavingsWithdrawalRow;
  onClose: () => void;
  onConfirm: (payload: { paymentSourceAccountId?: string; notes?: string }) => Promise<void> | void;
  isLoading?: boolean;
}

export function ApproveSavingsWithdrawalDialogContent({
  withdrawal,
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
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!selectedAccountId && paymentSources.length > 0) {
      const mandiri = paymentSources.find((a) => a.code === '11102');
      if (mandiri) setSelectedAccountId(mandiri.id);
      else setSelectedAccountId(paymentSources[0].id);
    }
  }, [paymentSources, selectedAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      paymentSourceAccountId: selectedAccountId || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack padding={4} gap={4}>
        <VStack gap={1}>
          <Heading level={3}>Setujui Penarikan Simpanan Sukarela</Heading>
          <Text type="supporting" color="secondary">
            Persetujuan akan memotong saldo simpanan sukarela anggota, mencatat mutasi penarikan di buku kas, dan membukukan jurnal otomatis.
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
            <Text type="body" weight="semibold">{withdrawal.memberName || 'Anggota Koperasi'}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Nominal Penarikan:</Text>
            <Text type="body" weight="bold" color="primary">{formatRp(withdrawal.amount)}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Rekening Tujuan:</Text>
            <Text type="body" weight="medium">
              {withdrawal.destinationBank} - {withdrawal.destinationAccount} (a.n. {withdrawal.destinationName})
            </Text>
          </HStack>
          {withdrawal.notes && (
            <HStack justify="space-between" vAlign="flex-start">
              <Text type="supporting" color="secondary">Catatan Pemohon:</Text>
              <Text type="supporting" style={{ maxWidth: 300, textAlign: 'right' }}>{withdrawal.notes}</Text>
            </HStack>
          )}
        </VStack>

        <VStack gap={2}>
          <label htmlFor="source-account" style={{ fontSize: 14, fontWeight: 600 }}>
            Sumber Dana Pembayaran (Kas / Bank)
          </label>
          <select
            id="source-account"
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

        <VStack gap={2}>
          <label htmlFor="admin-notes" style={{ fontSize: 14, fontWeight: 600 }}>
            Catatan Tambahan (Opsional)
          </label>
          <input
            id="admin-notes"
            type="text"
            placeholder="Contoh: Transfer via Mandiri Online No. Ref 987654"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          />
        </VStack>

        <HStack justify="flex-end" gap={2} style={{ marginTop: 8 }}>
          <Button label="Batal" variant="ghost" onClick={onClose} isDisabled={isLoading} />
          <Button
            label={isLoading ? 'Memproses...' : 'Setujui & Cairkan Dana'}
            variant="primary"
            type="submit"
            isDisabled={isLoading}
          />
        </HStack>
      </VStack>
    </form>
  );
}
