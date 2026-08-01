'use client';

import { useState, useMemo, useCallback } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Center } from '@astryxdesign/core/Center';
import { useToast } from '@astryxdesign/core/Toast';
import { api, ApiError } from '../../services/api';
import { formatAmountInput, formatRp, parseAmountInput } from '../../utils/format';

interface ScheduleRow {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidAmount: number;
  status: string;
}

type ScheduleDraft = {
  installmentNo: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  paidAmount: number;
  status: string;
};

function toIsoDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function scheduleToDraft(rows: ScheduleRow[]): ScheduleDraft[] {
  return rows.map((r) => ({
    installmentNo: r.installmentNo,
    dueDate: toIsoDateInput(r.dueDate),
    principalAmount: formatAmountInput(String(Math.round(Number(r.principalAmount)))),
    interestAmount: formatAmountInput(String(Math.round(Number(r.interestAmount)))),
    paidAmount: Number(r.paidAmount || 0),
    status: r.status,
  }));
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const inputCellStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--color-border-primary)',
};

interface LoanScheduleTableProps {
  loanId: string;
  pokok: number;
  interestRate: number | null | undefined;
  schedule: ScheduleRow[] | undefined;
  scheduleLoading: boolean;
  canEditSchedule: boolean;
  isSubmitting: boolean;
  onSaved: () => void;
}

/**
 * Jadwal angsuran section: view mode + edit mode + generate ulang.
 */
export function LoanScheduleTable({
  loanId,
  pokok,
  interestRate,
  schedule,
  scheduleLoading,
  canEditSchedule,
  isSubmitting: parentSubmitting,
  onSaved,
}: LoanScheduleTableProps) {
  const toast = useToast();
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft[]>(() =>
    schedule ? scheduleToDraft(schedule) : []
  );
  const [rateInput, setRateInput] = useState(
    interestRate != null ? String(interestRate) : '18'
  );
  const [isSaving, setIsSaving] = useState(false);

  const isSubmitting = parentSubmitting || isSaving;

  const draftPrincipalSum = useMemo(
    () => scheduleDraft.reduce((s, r) => s + parseAmountInput(r.principalAmount), 0),
    [scheduleDraft]
  );
  const draftAdminSum = useMemo(
    () => scheduleDraft.reduce((s, r) => s + parseAmountInput(r.interestAmount), 0),
    [scheduleDraft]
  );
  const principalMismatch = scheduleDraft.length > 0 && draftPrincipalSum !== pokok;

  const updateDraftRow = useCallback(
    (index: number, patch: Partial<ScheduleDraft>) => {
      setScheduleDraft((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    },
    []
  );

  const handleRegenerateSchedule = async () => {
    const rate = Number(String(rateInput).replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast({ body: 'Biaya admin harus 0–100 (% per tahun)', type: 'error' });
      return;
    }
    if (
      !window.confirm(
        `Generate ulang jadwal angsuran dengan biaya admin ${rate}% p.a.?\n` +
          'Pembayaran yang sudah ada akan dialokasikan ulang ke jadwal baru.'
      )
    )
      return;

    setIsSaving(true);
    try {
      await api.post(`/api/loans/${loanId}/schedule/regenerate`, { interestRate: rate });
      toast({ body: 'Jadwal angsuran di-generate ulang', type: 'info' });
      setIsEditingSchedule(false);
      onSaved();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal generate jadwal'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDraft.length) {
      toast({ body: 'Jadwal kosong', type: 'error' });
      return;
    }
    if (principalMismatch) {
      toast({
        body: `Jumlah pokok jadwal (${formatRp(draftPrincipalSum)}) harus sama dengan plafon (${formatRp(pokok)})`,
        type: 'error',
      });
      return;
    }
    if (
      !window.confirm(
        'Simpan perubahan jadwal angsuran? Pembayaran yang sudah ada akan dialokasikan ulang.'
      )
    )
      return;

    const rows = scheduleDraft.map((r) => ({
      installmentNo: r.installmentNo,
      dueDate: r.dueDate,
      principalAmount: parseAmountInput(r.principalAmount),
      interestAmount: parseAmountInput(r.interestAmount),
    }));

    setIsSaving(true);
    try {
      await api.put(`/api/loans/${loanId}/schedule`, { rows });
      toast({ body: 'Jadwal angsuran disimpan', type: 'info' });
      setIsEditingSchedule(false);
      onSaved();
    } catch (err) {
      toast({ body: errMessage(err, 'Gagal menyimpan jadwal'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack
      gap={4}
      style={{
        padding: 'var(--spacing-4)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-primary)',
      }}
    >
      <HStack hAlign="space-between" vAlign="center" wrap="wrap" gap={2}>
        <VStack gap={1}>
          <Heading level={4}>Jadwal Angsuran</Heading>
          <Text type="supporting" color="secondary">
            Rate saat ini:{' '}
            {interestRate != null ? `${interestRate}% p.a.` : '—'} ·{' '}
            {schedule?.length ?? 0} cicilan
          </Text>
        </VStack>
        {canEditSchedule && !isEditingSchedule && (
          <Button
            label="Edit Jadwal"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (schedule) setScheduleDraft(scheduleToDraft(schedule));
              setIsEditingSchedule(true);
            }}
            isDisabled={scheduleLoading || !schedule?.length}
          />
        )}
      </HStack>

      {canEditSchedule && (
        <VStack
          gap={3}
          style={{
            padding: 'var(--spacing-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-background-secondary)',
          }}
        >
          <Text type="body" weight="semibold">Generate ulang dengan rate baru</Text>
          <Text type="supporting" color="secondary">
            Mengganti seluruh jadwal pakai rumus anuitas. Pembayaran tetap ada dan dialokasikan
            ulang.
          </Text>
          <HStack gap={3} wrap="wrap" vAlign="end">
            <div style={{ minWidth: 160, flex: 1 }}>
              <TextInput
                label="Biaya Admin (% p.a.)"
                value={rateInput}
                onChange={(raw) => setRateInput(raw.replace(/[^\d.,]/g, ''))}
                type="text"
                placeholder="18"
              />
            </div>
            <Button
              label="Generate Ulang"
              variant="primary"
              onClick={handleRegenerateSchedule}
              isDisabled={isSubmitting}
            />
          </HStack>
        </VStack>
      )}

      {scheduleLoading ? (
        <Center style={{ height: 80 }}>
          <Spinner size="md" />
        </Center>
      ) : !scheduleDraft.length ? (
        <Text type="supporting" color="secondary">Belum ada jadwal angsuran.</Text>
      ) : isEditingSchedule ? (
        <VStack gap={3}>
          <Text
            type="supporting"
            color={principalMismatch ? 'critical' : 'secondary'}
          >
            Jumlah pokok semua baris harus = plafon ({formatRp(pokok)}). Saat ini:{' '}
            {formatRp(draftPrincipalSum)} · Total biaya admin: {formatRp(draftAdminSum)}
          </Text>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm, 13px)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Jatuh Tempo</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Pokok</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Biaya Admin</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleDraft.map((row, index) => (
                  <tr key={row.installmentNo}>
                    <td style={{ padding: '6px 4px' }}>{row.installmentNo}</td>
                    <td style={{ padding: '6px 4px', minWidth: 140 }}>
                      <input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => updateDraftRow(index, { dueDate: e.target.value })}
                        style={inputCellStyle}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', minWidth: 120 }}>
                      <input
                        type="text"
                        value={row.principalAmount}
                        onChange={(e) =>
                          updateDraftRow(index, { principalAmount: formatAmountInput(e.target.value) })
                        }
                        style={inputCellStyle}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', minWidth: 120 }}>
                      <input
                        type="text"
                        value={row.interestAmount}
                        onChange={(e) =>
                          updateDraftRow(index, { interestAmount: formatAmountInput(e.target.value) })
                        }
                        style={inputCellStyle}
                      />
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <Text type="supporting">
                        {row.status === 'Paid' ? 'Lunas' : row.status === 'Late' ? 'Terlambat' : 'Belum'}
                      </Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HStack gap={2} hAlign="end">
            <Button
              label="Batal"
              variant="secondary"
              onClick={() => {
                if (schedule) setScheduleDraft(scheduleToDraft(schedule));
                setIsEditingSchedule(false);
              }}
              isDisabled={isSubmitting}
            />
            <Button
              label="Simpan Jadwal"
              variant="primary"
              onClick={handleSaveSchedule}
              isDisabled={isSubmitting || principalMismatch}
            />
          </HStack>
        </VStack>
      ) : (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm, 13px)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Jatuh Tempo</th>
                <th style={{ textAlign: 'right', padding: '8px 4px' }}>Pokok</th>
                <th style={{ textAlign: 'right', padding: '8px 4px' }}>Biaya Admin</th>
                <th style={{ textAlign: 'right', padding: '8px 4px' }}>Tagihan</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduleDraft.map((row) => {
                const p = parseAmountInput(row.principalAmount);
                const i = parseAmountInput(row.interestAmount);
                return (
                  <tr
                    key={row.installmentNo}
                    style={{ borderTop: '1px solid var(--color-border-primary)' }}
                  >
                    <td style={{ padding: '8px 4px' }}>{row.installmentNo}</td>
                    <td style={{ padding: '8px 4px' }}>
                      {new Date(row.dueDate + 'T00:00:00').toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatRp(p)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatRp(i)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatRp(p + i)}</td>
                    <td style={{ padding: '8px 4px' }}>
                      {row.status === 'Paid' ? 'Lunas' : row.status === 'Late' ? 'Terlambat' : 'Belum'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </VStack>
  );
}
