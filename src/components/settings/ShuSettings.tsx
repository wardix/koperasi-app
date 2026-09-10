'use client';

import { useState, useMemo } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';
import { Badge } from '@astryxdesign/core/Badge';

export interface ShuSettingsValues {
  anggotaPct: string;
  cadanganPct: string;
  pengurusPct: string;
  sosialPct: string;
  pembangunanPct: string;
  jasaSimpananPct: string;
  jasaPinjamanPct: string;
}

interface ShuSettingsProps {
  initialValues?: Partial<ShuSettingsValues>;
  canUpdate: boolean;
  onSave: (values: ShuSettingsValues) => Promise<void> | void;
  isLoading?: boolean;
}

const DEFAULT_SHU_VALUES: ShuSettingsValues = {
  anggotaPct: '40',
  cadanganPct: '25',
  pengurusPct: '20',
  sosialPct: '10',
  pembangunanPct: '5',
  jasaSimpananPct: '50',
  jasaPinjamanPct: '50',
};

export function ShuSettings({
  initialValues,
  canUpdate,
  onSave,
  isLoading = false,
}: ShuSettingsProps) {
  const [formValues, setFormValues] = useState<ShuSettingsValues>({
    anggotaPct: initialValues?.anggotaPct ?? DEFAULT_SHU_VALUES.anggotaPct,
    cadanganPct: initialValues?.cadanganPct ?? DEFAULT_SHU_VALUES.cadanganPct,
    pengurusPct: initialValues?.pengurusPct ?? DEFAULT_SHU_VALUES.pengurusPct,
    sosialPct: initialValues?.sosialPct ?? DEFAULT_SHU_VALUES.sosialPct,
    pembangunanPct: initialValues?.pembangunanPct ?? DEFAULT_SHU_VALUES.pembangunanPct,
    jasaSimpananPct: initialValues?.jasaSimpananPct ?? DEFAULT_SHU_VALUES.jasaSimpananPct,
    jasaPinjamanPct: initialValues?.jasaPinjamanPct ?? DEFAULT_SHU_VALUES.jasaPinjamanPct,
  });

  const handleChange = (field: keyof ShuSettingsValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetDefaults = () => {
    setFormValues(DEFAULT_SHU_VALUES);
  };

  // Calculations
  const primaryTotal = useMemo(() => {
    const a = parseFloat(formValues.anggotaPct) || 0;
    const c = parseFloat(formValues.cadanganPct) || 0;
    const p = parseFloat(formValues.pengurusPct) || 0;
    const s = parseFloat(formValues.sosialPct) || 0;
    const b = parseFloat(formValues.pembangunanPct) || 0;
    return Math.round((a + c + p + s + b) * 100) / 100;
  }, [formValues]);

  const memberTotal = useMemo(() => {
    const s = parseFloat(formValues.jasaSimpananPct) || 0;
    const p = parseFloat(formValues.jasaPinjamanPct) || 0;
    return Math.round((s + p) * 100) / 100;
  }, [formValues]);

  const isPrimaryValid = Math.abs(primaryTotal - 100) < 0.01;
  const isMemberValid = Math.abs(memberTotal - 100) < 0.01;
  const isValid = isPrimaryValid && isMemberValid;

  return (
    <Grid columns={{ minWidth: 320 }} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Alokasi SHU (AD/ART)</Heading>
        <Text type="supporting" color="secondary">
          Atur persentase pembagian Sisa Hasil Usaha (SHU) sesuai Anggaran Dasar dan Anggaran Rumah Tangga koperasi.
        </Text>
      </VStack>

      <VStack gap={6}>
        {/* Seksi 1: Distribusi SHU Netto */}
        <VStack gap={3}>
          <HStack justify="space-between" vAlign="center">
            <VStack gap={0}>
              <Text type="body" weight="semibold">
                1. Distribusi SHU Netto
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>
                Pembagian total SHU Netto ke masing-masing pos dana koperasi (total wajib 100%).
              </Text>
            </VStack>
            <Badge
              variant={isPrimaryValid ? 'success' : 'critical'}
              label={`Total: ${primaryTotal}% ${isPrimaryValid ? '✓ Pas' : primaryTotal > 100 ? `(Lebih ${(primaryTotal - 100).toFixed(1)}%)` : `(Kurang ${(100 - primaryTotal).toFixed(1)}%)`}`}
              size="sm"
            />
          </HStack>

          <Grid columns={3} gap={4}>
            <TextInput
              label="Alokasi Anggota (%)"
              type="number"
              value={formValues.anggotaPct}
              onChange={(v) => handleChange('anggotaPct', v)}
              disabled={!canUpdate || isLoading}
            />
            <TextInput
              label="Dana Cadangan (%)"
              type="number"
              value={formValues.cadanganPct}
              onChange={(v) => handleChange('cadanganPct', v)}
              disabled={!canUpdate || isLoading}
            />
            <TextInput
              label="Jasa Pengurus & Pengawas (%)"
              type="number"
              value={formValues.pengurusPct}
              onChange={(v) => handleChange('pengurusPct', v)}
              disabled={!canUpdate || isLoading}
            />
            <TextInput
              label="Dana Sosial (%)"
              type="number"
              value={formValues.sosialPct}
              onChange={(v) => handleChange('sosialPct', v)}
              disabled={!canUpdate || isLoading}
            />
            <TextInput
              label="Dana Pembangunan Kerja (%)"
              type="number"
              value={formValues.pembangunanPct}
              onChange={(v) => handleChange('pembangunanPct', v)}
              disabled={!canUpdate || isLoading}
            />
          </Grid>
        </VStack>

        {/* Seksi 2: Porsi Bagian Anggota */}
        <VStack gap={3}>
          <HStack justify="space-between" vAlign="center">
            <VStack gap={0}>
              <Text type="body" weight="semibold">
                2. Pembagian Alokasi Anggota
              </Text>
              <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>
                Proporsi pembagian bagian anggota antara Jasa Simpanan dan Jasa Pinjaman (total wajib 100%).
              </Text>
            </VStack>
            <Badge
              variant={isMemberValid ? 'success' : 'critical'}
              label={`Total: ${memberTotal}% ${isMemberValid ? '✓ Pas' : memberTotal > 100 ? `(Lebih ${(memberTotal - 100).toFixed(1)}%)` : `(Kurang ${(100 - memberTotal).toFixed(1)}%)`}`}
              size="sm"
            />
          </HStack>

          <Grid columns={2} gap={4}>
            <TextInput
              label="Jasa Simpanan / Modal (%)"
              type="number"
              value={formValues.jasaSimpananPct}
              onChange={(v) => handleChange('jasaSimpananPct', v)}
              disabled={!canUpdate || isLoading}
            />
            <TextInput
              label="Jasa Pinjaman / Usaha (%)"
              type="number"
              value={formValues.jasaPinjamanPct}
              onChange={(v) => handleChange('jasaPinjamanPct', v)}
              disabled={!canUpdate || isLoading}
            />
          </Grid>
        </VStack>

        {/* Action Buttons */}
        {canUpdate && (
          <HStack gap={3} vAlign="center">
            <Button
              label={isLoading ? 'Menyimpan...' : 'Simpan Alokasi SHU'}
              variant="primary"
              isDisabled={!isValid || isLoading}
              onClick={() => onSave(formValues)}
            />
            <Button
              label="Reset ke Default AD/ART"
              variant="ghost"
              isDisabled={isLoading}
              onClick={handleResetDefaults}
            />
          </HStack>
        )}
      </VStack>
    </Grid>
  );
}
