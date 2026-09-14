import React, { useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { formatRp } from '../utils/format';
import type { LoanRow } from '../shared/types';

interface Props {
  loan: LoanRow;
  onClose: () => void;
  onConfirm: (rejectionReason: string) => Promise<void> | void;
  isLoading?: boolean;
}

const COMMON_REASONS = [
  'Kapasitas cicilan / rasio penghasilan belum mencukupi',
  'Riwayat pinjaman sebelumnya masih memiliki tunggakan',
  'Dokumen persyaratan / bukti pendukung tidak lengkap',
  'Plafon pinjaman melebihi batas maksimal yang diperbolehkan',
];

export function RejectLoanDialogContent({
  loan,
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
    <form onSubmit={handleSubmit} noValidate>
      <VStack padding={4} gap={4}>
        <VStack gap={1}>
          <Heading level={3}>Tolak Pengajuan Pinjaman</Heading>
          <Text type="supporting" color="secondary">
            Pengajuan pinjaman akan ditolak. Alasan penolakan akan dicatat dan disampaikan kepada peminjam melalui portal anggota dan notifikasi.
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
            <Text type="supporting" color="secondary">Nama Peminjam:</Text>
            <Text type="body" weight="semibold">{loan.name || 'Anggota Koperasi'}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Nominal Pengajuan:</Text>
            <Text type="body" weight="bold" color="critical">{formatRp(loan.amount)}</Text>
          </HStack>
          <HStack justify="space-between" vAlign="center">
            <Text type="supporting" color="secondary">Tenor:</Text>
            <Text type="body">{loan.tenor} Bulan</Text>
          </HStack>
          {loan.purpose && (
            <HStack justify="space-between" vAlign="center">
              <Text type="supporting" color="secondary">Keperluan:</Text>
              <Text type="body">{loan.purpose}</Text>
            </HStack>
          )}
        </VStack>

        <VStack gap={2}>
          <label htmlFor="rejection-reason" style={{ fontSize: 14, fontWeight: 600 }}>
            Alasan Penolakan <span style={{ color: 'var(--color-critical-500, #ef4444)' }}>*</span>
          </label>

          {/* Quick template suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {COMMON_REASONS.map((common) => (
              <button
                type="button"
                key={common}
                onClick={() => {
                  setReason(common);
                  if (error) setError('');
                }}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 16,
                  border: '1px solid var(--color-border-primary, #d1d5db)',
                  backgroundColor: reason === common ? 'var(--color-primary-50, #eff6ff)' : 'var(--color-background-primary, #ffffff)',
                  color: reason === common ? 'var(--color-primary-700, #1d4ed8)' : 'var(--color-text-secondary, #4b5563)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {common}
              </button>
            ))}
          </div>

          <textarea
            id="rejection-reason"
            rows={3}
            placeholder="Pilih opsi di atas atau ketik alasan penolakan secara spesifik..."
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
            label={isLoading ? 'Menolak...' : 'Tolak Pinjaman'}
            variant="critical"
            type="submit"
            isDisabled={isLoading}
          />
        </HStack>
      </VStack>
    </form>
  );
}
