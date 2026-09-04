import React, { useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { formatRp } from '../utils/format';
import type { SavingsWithdrawalRow } from '../shared/types';

interface Props {
  withdrawal: SavingsWithdrawalRow;
  onClose: () => void;
  onConfirm: (rejectionReason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function RejectSavingsWithdrawalDialogContent({
  withdrawal,
  onClose,
  onConfirm,
  isLoading = false,
}: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Alasan penolakan wajib diisi');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack padding={4} gap={4}>
        <VStack gap={1}>
          <Heading level={3}>Tolak Penarikan Simpanan Sukarela</Heading>
          <Text type="supporting" color="secondary">
            Pengajuan penarikan akan ditolak dan saldo simpanan anggota tidak akan dipotong. Alasan penolakan akan ditampilkan di portal anggota.
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
            <Text type="body" weight="bold" color="critical">{formatRp(withdrawal.amount)}</Text>
          </HStack>
        </VStack>

        <VStack gap={2}>
          <label htmlFor="rejection-reason" style={{ fontSize: 14, fontWeight: 600 }}>
            Alasan Penolakan <span style={{ color: 'var(--color-critical-500, #ef4444)' }}>*</span>
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            placeholder="Contoh: Nomor rekening tujuan tidak valid / nama tidak sesuai dengan data anggota."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${error ? 'var(--color-critical-500, #ef4444)' : 'var(--color-border-primary, #e5e7eb)'}`,
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #111827)',
              fontSize: 14,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
            required
          />
          {error && (
            <Text type="supporting" color="critical" style={{ fontSize: 12 }}>
              {error}
            </Text>
          )}
        </VStack>

        <HStack justify="flex-end" gap={2} style={{ marginTop: 8 }}>
          <Button label="Batal" variant="ghost" onClick={onClose} isDisabled={isLoading} />
          <Button
            label={isLoading ? 'Menolak...' : 'Tolak Permohonan'}
            variant="critical"
            type="submit"
            isDisabled={isLoading}
          />
        </HStack>
      </VStack>
    </form>
  );
}
