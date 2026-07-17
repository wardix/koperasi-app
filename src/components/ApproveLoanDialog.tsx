import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Button} from '@astryxdesign/core/Button';
import {formatRp} from '../utils/format';
import type {LoanRow} from '../shared/types';

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

interface Props {
  loan: LoanRow;
  onClose: () => void;
  onConfirm: (approvedDate: string) => void;
}

export function ApproveLoanDialogContent({loan, onClose, onConfirm}: Props) {
  const [approvedDate, setApprovedDate] = useState(defaultApprovedDate(loan));

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Setujui Pinjaman</Heading>
        <Text type="supporting" color="secondary">
          Pilih tanggal pencairan. Untuk data historis, isi tanggal saat pinjaman benar-benar
          dicairkan — jangan biarkan tanggal hari ini jika transaksi sudah lewat.
        </Text>
      </VStack>

      <VStack gap={2}>
        <Text type="body" weight="semibold">{loan.name}</Text>
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

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button
          label="Setujui & Catat Pencairan"
          variant="primary"
          onClick={() => {
            if (!approvedDate) return;
            onConfirm(approvedDate);
          }}
        />
      </HStack>
    </VStack>
  );
}
