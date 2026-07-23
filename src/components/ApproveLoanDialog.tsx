import {useMemo, useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {DateInput} from '@astryxdesign/core/DateInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {formatRp} from '../utils/format';
import {useApiQuery} from '../hooks/useApiQuery';
import type {LoanRow, SettingsData} from '../shared/types';

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Prefer loan.createdAt (application/loan date) as default disbursement date. */
function defaultApprovedDate(loan: LoanRow): string {
  if (loan.createdAt) {
    const d = new Date(loan.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return todayIsoDate();
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
  onConfirm: (payload: {approvedDate: string; interestRate: number}) => void;
}

export function ApproveLoanDialogContent({loan, onClose, onConfirm}: Props) {
  const {data: settings} = useApiQuery<SettingsData>('/api/settings');
  const defaultRate = parseFloat(settings?.bungaPinjaman || '0') || 0;

  const [approvedDate, setApprovedDate] = useState(defaultApprovedDate(loan));
  const [rateInput, setRateInput] = useState<string | null>(null);
  const [rateError, setRateError] = useState('');

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

      <DateInput
        label="Tanggal Pencairan / Persetujuan"
        description="Tanggal ini dipakai di Arus Kas (pencairan) dan jadwal angsuran"
        value={approvedDate}
        onChange={(val) => setApprovedDate(val ?? todayIsoDate())}
        max={todayIsoDate()}
        isRequired
      />

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
          <Text type="supporting" color="error" style={{color: 'var(--color-text-critical, red)'}}>
            {rateError}
          </Text>
        ) : null}
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
            onConfirm({approvedDate, interestRate: rate});
          }}
        />
      </HStack>
    </VStack>
  );
}
