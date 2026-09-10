'use client';

import { useState, useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Grid } from '@astryxdesign/core/Grid';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { api } from '../services/api';
import type { ShuConfig } from '../shared/types';

interface ShuConfigDialogProps {
  currentConfig?: ShuConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_SHU_CONFIG: ShuConfig = {
  anggotaPct: 40,
  cadanganPct: 25,
  pengurusPct: 20,
  sosialPct: 10,
  pembangunanPct: 5,
  jasaSimpananPct: 50,
  jasaPinjamanPct: 50,
  includeInactiveMembers: true,
};

export function ShuConfigDialog({ currentConfig, onClose, onSuccess }: ShuConfigDialogProps) {
  const [form, setForm] = useState({
    anggotaPct: (currentConfig?.anggotaPct ?? DEFAULT_SHU_CONFIG.anggotaPct).toString(),
    cadanganPct: (currentConfig?.cadanganPct ?? DEFAULT_SHU_CONFIG.cadanganPct).toString(),
    pengurusPct: (currentConfig?.pengurusPct ?? DEFAULT_SHU_CONFIG.pengurusPct).toString(),
    sosialPct: (currentConfig?.sosialPct ?? DEFAULT_SHU_CONFIG.sosialPct).toString(),
    pembangunanPct: (currentConfig?.pembangunanPct ?? DEFAULT_SHU_CONFIG.pembangunanPct).toString(),
    jasaSimpananPct: (currentConfig?.jasaSimpananPct ?? DEFAULT_SHU_CONFIG.jasaSimpananPct).toString(),
    jasaPinjamanPct: (currentConfig?.jasaPinjamanPct ?? DEFAULT_SHU_CONFIG.jasaPinjamanPct).toString(),
    includeInactiveMembers: currentConfig?.includeInactiveMembers ?? true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const primaryTotal = useMemo(() => {
    const a = parseFloat(form.anggotaPct) || 0;
    const c = parseFloat(form.cadanganPct) || 0;
    const p = parseFloat(form.pengurusPct) || 0;
    const s = parseFloat(form.sosialPct) || 0;
    const b = parseFloat(form.pembangunanPct) || 0;
    return Math.round((a + c + p + s + b) * 100) / 100;
  }, [form]);

  const memberTotal = useMemo(() => {
    const s = parseFloat(form.jasaSimpananPct) || 0;
    const p = parseFloat(form.jasaPinjamanPct) || 0;
    return Math.round((s + p) * 100) / 100;
  }, [form]);

  const isPrimaryValid = Math.abs(primaryTotal - 100) < 0.01;
  const isMemberValid = Math.abs(memberTotal - 100) < 0.01;
  const isValid = isPrimaryValid && isMemberValid;

  const handleResetDefaults = () => {
    setForm({
      anggotaPct: DEFAULT_SHU_CONFIG.anggotaPct.toString(),
      cadanganPct: DEFAULT_SHU_CONFIG.cadanganPct.toString(),
      pengurusPct: DEFAULT_SHU_CONFIG.pengurusPct.toString(),
      sosialPct: DEFAULT_SHU_CONFIG.sosialPct.toString(),
      pembangunanPct: DEFAULT_SHU_CONFIG.pembangunanPct.toString(),
      jasaSimpananPct: DEFAULT_SHU_CONFIG.jasaSimpananPct.toString(),
      jasaPinjamanPct: DEFAULT_SHU_CONFIG.jasaPinjamanPct.toString(),
      includeInactiveMembers: DEFAULT_SHU_CONFIG.includeInactiveMembers ?? true,
    });
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.put('/api/v1/shu/config', {
        anggotaPct: parseFloat(form.anggotaPct),
        cadanganPct: parseFloat(form.cadanganPct),
        pengurusPct: parseFloat(form.pengurusPct),
        sosialPct: parseFloat(form.sosialPct),
        pembangunanPct: parseFloat(form.pembangunanPct),
        jasaSimpananPct: parseFloat(form.jasaSimpananPct),
        jasaPinjamanPct: parseFloat(form.jasaPinjamanPct),
        includeInactiveMembers: form.includeInactiveMembers,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan konfigurasi alokasi SHU');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <Card style={{ width: 560, padding: 24, maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <form onSubmit={handleSave}>
          <VStack gap={5}>
            <VStack gap={1}>
              <Heading level={3}>Atur Alokasi SHU (AD/ART)</Heading>
              <Text type="supporting" color="secondary">
                Ubah persentase distribusi Sisa Hasil Usaha sesuai ketentuan AD/ART koperasi.
              </Text>
            </VStack>

            {errorMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--color-error-500, #ef4444)',
                  color: 'var(--color-error-500, #ef4444)',
                  fontSize: 13,
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Bagian 1: Distribusi SHU Netto */}
            <VStack gap={3}>
              <HStack justify="space-between" vAlign="center">
                <Text type="body" weight="semibold">
                  1. Distribusi SHU Netto
                </Text>
                <Badge
                  variant={isPrimaryValid ? 'success' : 'critical'}
                  label={`Total: ${primaryTotal}% ${isPrimaryValid ? '✓' : primaryTotal > 100 ? `(+${(primaryTotal - 100).toFixed(1)}%)` : `(-${(100 - primaryTotal).toFixed(1)}%)`}`}
                  size="sm"
                />
              </HStack>

              <Grid columns={2} gap={3}>
                <TextInput
                  label="Alokasi Anggota (%)"
                  type="number"
                  value={form.anggotaPct}
                  onChange={(v) => setForm((p) => ({ ...p, anggotaPct: v }))}
                  disabled={isSubmitting}
                />
                <TextInput
                  label="Dana Cadangan (%)"
                  type="number"
                  value={form.cadanganPct}
                  onChange={(v) => setForm((p) => ({ ...p, cadanganPct: v }))}
                  disabled={isSubmitting}
                />
                <TextInput
                  label="Jasa Pengurus & Pengawas (%)"
                  type="number"
                  value={form.pengurusPct}
                  onChange={(v) => setForm((p) => ({ ...p, pengurusPct: v }))}
                  disabled={isSubmitting}
                />
                <TextInput
                  label="Dana Sosial (%)"
                  type="number"
                  value={form.sosialPct}
                  onChange={(v) => setForm((p) => ({ ...p, sosialPct: v }))}
                  disabled={isSubmitting}
                />
              </Grid>
              <TextInput
                label="Dana Pembangunan Kerja (%)"
                type="number"
                value={form.pembangunanPct}
                onChange={(v) => setForm((p) => ({ ...p, pembangunanPct: v }))}
                disabled={isSubmitting}
              />
            </VStack>

            {/* Bagian 2: Pembagian Alokasi Anggota */}
            <VStack gap={3}>
              <HStack justify="space-between" vAlign="center">
                <Text type="body" weight="semibold">
                  2. Pembagian Porsi Anggota
                </Text>
                <Badge
                  variant={isMemberValid ? 'success' : 'critical'}
                  label={`Total: ${memberTotal}% ${isMemberValid ? '✓' : memberTotal > 100 ? `(+${(memberTotal - 100).toFixed(1)}%)` : `(-${(100 - memberTotal).toFixed(1)}%)`}`}
                  size="sm"
                />
              </HStack>

              <Grid columns={2} gap={3}>
                <TextInput
                  label="Jasa Modal / Simpanan (%)"
                  type="number"
                  value={form.jasaSimpananPct}
                  onChange={(v) => setForm((p) => ({ ...p, jasaSimpananPct: v }))}
                  disabled={isSubmitting}
                />
                <TextInput
                  label="Jasa Usaha / Pinjaman (%)"
                  type="number"
                  value={form.jasaPinjamanPct}
                  onChange={(v) => setForm((p) => ({ ...p, jasaPinjamanPct: v }))}
                  disabled={isSubmitting}
                />
              </Grid>
            </VStack>

            {/* Bagian 3: Kebijakan Mantan Anggota */}
            <VStack gap={2}>
              <Text type="body" weight="semibold">
                3. Kebijakan Mantan Anggota
              </Text>
              <CheckboxInput
                label="Alokasikan SHU Pro-Rata untuk Mantan Anggota"
                description="Anggota yang mengundurkan diri sebelum akhir tahun tetap berhak atas SHU pro-rata sesuai saldo rata-rata harian (ADB) saat masih aktif. Jika tidak dicentang, hak SHU hangus bagi anggota nonaktif."
                value={form.includeInactiveMembers}
                onChange={(v) => setForm((p) => ({ ...p, includeInactiveMembers: v }))}
                disabled={isSubmitting}
              />
            </VStack>

            {/* Tombol Aksi */}
            <HStack justify="space-between" vAlign="center" style={{ marginTop: 8 }}>
              <Button
                label="Reset Default AD/ART"
                variant="ghost"
                type="button"
                isDisabled={isSubmitting}
                onClick={handleResetDefaults}
              />
              <HStack gap={2}>
                <Button
                  label="Batal"
                  variant="secondary"
                  type="button"
                  isDisabled={isSubmitting}
                  onClick={onClose}
                />
                <Button
                  label={isSubmitting ? 'Menyimpan...' : 'Simpan & Terapkan'}
                  variant="primary"
                  type="submit"
                  isDisabled={!isValid || isSubmitting}
                />
              </HStack>
            </HStack>
          </VStack>
        </form>
      </Card>
    </div>
  );
}
