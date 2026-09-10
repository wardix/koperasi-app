import {useMemo, useState, useEffect} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {DateInput} from '@astryxdesign/core/DateInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {formatRp, formatDate} from '../utils/format';
import {useApiQuery} from '../hooks/useApiQuery';
import {CopyableAccountNumber} from './CopyableAccountNumber';
import type {LoanRow, SettingsData} from '../shared/types';

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getEndOfMonth(year: number, month1Indexed: number): string {
  const d = new Date(year, month1Indexed, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isEndOfMonthStr(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  const maxDay = new Date(year, month, 0).getDate();
  return day === maxDay;
}

export function getDefaultFirstDueDate(approvedDateStr: string): string {
  const parts = approvedDateStr.split('-').map(Number);
  if (parts.length !== 3) return todayIsoDate();
  const [year, month, day] = parts;
  if (day <= 20) {
    return getEndOfMonth(year, month);
  }
  return getEndOfMonth(year, month + 1);
}

export function computeScheduleDueDates(firstDueDateStr: string, tenorMonths: number): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDueDateStr);
  if (!match) return [];
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const isEOM = isEndOfMonthStr(firstDueDateStr);

  const dueDates: string[] = [];
  for (let i = 0; i < tenorMonths; i++) {
    const targetMonthIndex = (startMonth - 1) + i;
    if (isEOM) {
      const d = new Date(startYear, targetMonthIndex + 1, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dueDates.push(`${yyyy}-${mm}-${dd}`);
    } else {
      const maxDay = new Date(startYear, targetMonthIndex + 1, 0).getDate();
      const actualDay = Math.min(startDay, maxDay);
      const d = new Date(startYear, targetMonthIndex, actualDay);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dueDates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dueDates;
}

function simulateAnnuity(amount: number, tenorMonths: number, annualRatePercent: number) {
  const tenor = Math.max(1, tenorMonths || 1);
  if (amount <= 0) return null;

  if (annualRatePercent <= 0) {
    return {
      interestAmount: 0,
      totalRepayment: amount,
      monthlyInstallment: Math.ceil(amount / tenor),
    };
  }

  const i = annualRatePercent / 1200;
  const power = Math.pow(1 + i, tenor);
  const monthlyInstallment = Math.ceil((amount * (i * power)) / (power - 1));
  const totalRepayment = monthlyInstallment * tenor;
  const interestAmount = totalRepayment - amount;

  return {interestAmount, totalRepayment, monthlyInstallment};
}

function parseRateInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

interface Props {
  loan: LoanRow;
  onClose: () => void;
  onConfirm: (payload: {
    approvedDate: string;
    interestRate: number;
    paymentSourceAccountId?: string;
    firstInstallmentDate?: string;
  }) => void;
}

export function ApproveLoanDialogContent({loan, onClose, onConfirm}: Props) {
  const {data: settings} = useApiQuery<SettingsData>('/api/settings');
  const defaultRate = parseFloat(settings?.bungaPinjaman || '0') || 0;

  const {data: paymentSourcesRes} = useApiQuery<{success: boolean; data: Array<{id: string; code: string; name: string; type: string}>}>('/api/loans/payment-sources');
  const paymentSources = paymentSourcesRes?.data || [];
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    if (!selectedAccountId && paymentSources.length > 0) {
      const mandiri = paymentSources.find((a) => a.code === '11102');
      if (mandiri) setSelectedAccountId(mandiri.id);
      else setSelectedAccountId(paymentSources[0].id);
    }
  }, [paymentSources, selectedAccountId]);

  const [approvedDate, setApprovedDate] = useState(() => todayIsoDate());
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(() => getDefaultFirstDueDate(todayIsoDate()));
  const [rateInput, setRateInput] = useState<string | null>(null);
  const [rateError, setRateError] = useState('');

  const handleApprovedDateChange = (val: string | null) => {
    const nextApproved = val ?? todayIsoDate();
    setApprovedDate(nextApproved);
    setFirstInstallmentDate(getDefaultFirstDueDate(nextApproved));
  };

  // Once settings load, seed the input if user has not typed yet
  const rateStr =
    rateInput !== null
      ? rateInput
      : settings
        ? String(defaultRate)
        : '';

  const parsedRate = parseRateInput(rateStr);
  const tenorMonths = Math.max(1, Number(loan.tenor) || 1);
  const simulation = useMemo(
    () =>
      parsedRate != null
        ? simulateAnnuity(Number(loan.amount), tenorMonths, parsedRate)
        : null,
    [loan.amount, tenorMonths, parsedRate]
  );

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Setujui Pinjaman</Heading>
        <Text type="supporting" color="secondary">
          Pilih tanggal pencairan dan biaya admin (% per tahun). Nilai ini dipakai untuk
          membuat jadwal angsuran pinjaman ini (bisa beda dari pengaturan global).
        </Text>
      </VStack>

      <VStack gap={2}>
        <Text type="body" weight="semibold">
          {loan.name}
        </Text>
        <Text type="supporting" color="secondary">
          Pokok {formatRp(loan.amount)} · Tenor {loan.tenor} bulan
        </Text>
      </VStack>

      {(loan.destinationBank || loan.destinationAccount) && (
        <VStack
          gap={1}
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
            borderRadius: 6,
            border: '1px solid var(--color-border-primary, #e5e7eb)',
          }}
        >
          <Text type="supporting" color="secondary" weight="medium">
            Rekening Tujuan Pencairan:
          </Text>
          <CopyableAccountNumber
            bankName={loan.destinationBank}
            accountNumber={loan.destinationAccount}
            accountHolder={loan.destinationName || loan.name}
          />
        </VStack>
      )}

      <DateInput
        label="Tanggal Pencairan / Persetujuan"
        description="Tanggal ini dipakai di Arus Kas (pencairan) dan jadwal angsuran"
        value={approvedDate}
        onChange={handleApprovedDateChange}
        max={todayIsoDate()}
        isRequired
      />

      <VStack gap={2}>
        <DateInput
          label="Tanggal Angsuran Pertama"
          description="Pilih tanggal jatuh tempo angsuran ke-1. Jika memilih akhir bulan, angsuran berikutnya otomatis jatuh di setiap akhir bulan."
          value={firstInstallmentDate}
          onChange={(val) => setFirstInstallmentDate(val ?? todayIsoDate())}
          isRequired
        />

        {/* Shortcut buttons */}
        {(() => {
          const parts = approvedDate.split('-').map(Number);
          const y = parts[0] || new Date().getFullYear();
          const m = parts[1] || (new Date().getMonth() + 1);
          const endOfThisMonth = getEndOfMonth(y, m);
          const endOfNextMonth = getEndOfMonth(y, m + 1);

          return (
            <HStack gap={2} wrap="wrap">
              <button
                type="button"
                onClick={() => setFirstInstallmentDate(endOfThisMonth)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: firstInstallmentDate === endOfThisMonth ? '1px solid var(--color-primary-500, #0171E3)' : '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: firstInstallmentDate === endOfThisMonth ? 'rgba(1, 113, 227, 0.1)' : 'transparent',
                  color: firstInstallmentDate === endOfThisMonth ? 'var(--color-primary-500, #0171E3)' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Akhir Bulan Ini ({formatDate(endOfThisMonth)})
              </button>
              <button
                type="button"
                onClick={() => setFirstInstallmentDate(endOfNextMonth)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: firstInstallmentDate === endOfNextMonth ? '1px solid var(--color-primary-500, #0171E3)' : '1px solid var(--color-border-primary, #e5e7eb)',
                  backgroundColor: firstInstallmentDate === endOfNextMonth ? 'rgba(1, 113, 227, 0.1)' : 'transparent',
                  color: firstInstallmentDate === endOfNextMonth ? 'var(--color-primary-500, #0171E3)' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Akhir Bulan Depan ({formatDate(endOfNextMonth)})
              </button>
            </HStack>
          );
        })()}

        {/* Pattern Explanation Callout */}
        {isEndOfMonthStr(firstInstallmentDate) ? (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success-500, #10B981)',
            fontSize: '12px',
            color: 'var(--color-success-500, #10B981)',
            lineHeight: 1.4,
          }}>
            ✨ <strong>Pola Akhir Bulan Terdeteksi:</strong> Tanggal yang dipilih adalah akhir bulan. Seluruh angsuran berikutnya akan otomatis jatuh pada <strong>setiap akhir bulan</strong> (30/31 atau 28/29).
          </div>
        ) : (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
            border: '1px solid var(--color-border-primary, #e5e7eb)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
          }}>
            ℹ️ <strong>Pola Tanggal Tetap:</strong> Angsuran berikutnya akan otomatis jatuh pada <strong>tanggal {Number(firstInstallmentDate.split('-')[2]) || 1}</strong> setiap bulannya.
          </div>
        )}
      </VStack>

      <VStack gap={1}>
        <TextInput
          label="Biaya Admin (% per tahun)"
          description={
            settings
              ? `Default dari Pengaturan: ${defaultRate}% p.a. Bisa diubah khusus untuk pinjaman ini.`
              : 'Memuat default dari pengaturan…'
          }
          type="text"
          value={rateStr}
          onChange={(raw) => {
            setRateInput(raw.replace(/[^\d.,]/g, ''));
            setRateError('');
          }}
          placeholder="Contoh: 18"
          isRequired
        />
        {rateError ? (
          <Text type="supporting" color="critical">
            {rateError}
          </Text>
        ) : null}
      </VStack>

      <VStack gap={1}>
        <Text type="body" weight="medium">
          Sumber Dana Pencairan
        </Text>
        <Text type="supporting" color="secondary">
          Akun kas/bank yang akan dikreditkan saat pinjaman dicairkan
        </Text>
        <select
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

      {simulation && parsedRate != null ? (
        <VStack
          gap={2}
          style={{
            padding: 'var(--spacing-3)',
            backgroundColor: 'var(--color-background-secondary, var(--color-background-body))',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border-primary, var(--color-border, #e5e7eb))',
            width: '100%',
          }}
        >
          <Text type="body" weight="bold">
            Pratinjau angsuran ({parsedRate}% p.a.)
          </Text>
          <HStack hAlign="space-between" style={{width: '100%'}}>
            <Text type="supporting" color="secondary">
              Total biaya admin
            </Text>
            <Text type="body" weight="semibold">
              {formatRp(simulation.interestAmount)}
            </Text>
          </HStack>
          <HStack hAlign="space-between" style={{width: '100%'}}>
            <Text type="supporting" color="secondary">
              Total pengembalian
            </Text>
            <Text type="body" weight="semibold">
              {formatRp(simulation.totalRepayment)}
            </Text>
          </HStack>
          <HStack hAlign="space-between" style={{width: '100%'}}>
            <Text type="body" weight="bold">
              Angsuran / bulan
            </Text>
            <Text type="body" weight="bold" color="accent">
              {formatRp(simulation.monthlyInstallment)}
            </Text>
          </HStack>

          {/* Pratinjau Jadwal Jatuh Tempo */}
          {(() => {
            const previewDueDates = computeScheduleDueDates(firstInstallmentDate, tenorMonths);
            if (previewDueDates.length === 0) return null;
            return (
              <div style={{
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '1px solid var(--color-border-primary, #e5e7eb)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <Text type="supporting" color="secondary" weight="semibold">
                  Jadwal Jatuh Tempo ({tenorMonths} bulan):
                </Text>
                <HStack hAlign="space-between" style={{ width: '100%' }}>
                  <Text type="supporting" color="secondary">Angsuran #1 (Pertama):</Text>
                  <Text type="body" weight="semibold">{formatDate(previewDueDates[0])}</Text>
                </HStack>
                {previewDueDates.length > 1 && (
                  <HStack hAlign="space-between" style={{ width: '100%' }}>
                    <Text type="supporting" color="secondary">Angsuran #2:</Text>
                    <Text type="body">{formatDate(previewDueDates[1])}</Text>
                  </HStack>
                )}
                {previewDueDates.length > 2 && (
                  <HStack hAlign="space-between" style={{ width: '100%' }}>
                    <Text type="supporting" color="secondary">Angsuran #{tenorMonths} (Terakhir):</Text>
                    <Text type="body" weight="semibold">{formatDate(previewDueDates[previewDueDates.length - 1])}</Text>
                  </HStack>
                )}
              </div>
            );
          })()}
        </VStack>
      ) : null}

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button
          label="Setujui & Catat Pencairan"
          variant="primary"
          onClick={() => {
            if (!approvedDate) return;
            const rate = parseRateInput(rateStr);
            if (rate == null) {
              setRateError('Isi biaya admin 0–100 (% per tahun)');
              return;
            }
            onConfirm({
              approvedDate,
              interestRate: rate,
              paymentSourceAccountId: selectedAccountId || undefined,
              firstInstallmentDate: firstInstallmentDate || undefined,
            });
          }}
        />
      </HStack>
    </VStack>
  );
}
