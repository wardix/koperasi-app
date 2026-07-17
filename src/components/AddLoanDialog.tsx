import {useState, useMemo} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Button} from '@astryxdesign/core/Button';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import {useApiQuery} from '../hooks/useApiQuery';
import type {PaginatedResponse, MemberRow, LoanRow, SettingsData} from '../shared/types';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';

interface Props {
  onClose: () => void;
  onAdd: (loan: Omit<LoanRow, 'id'> & { loanDate?: string }) => void;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Match server calculateLoanInterest for client-side simulation. */
function simulateAnnuity(amount: number, tenorMonths: number, annualRatePercent: number) {
  const tenor = Math.max(1, tenorMonths || 1);
  if (amount <= 0) return null;

  if (annualRatePercent <= 0) {
    return {
      interestAmount: 0,
      totalRepayment: amount,
      monthlyInstallment: Math.ceil(amount / tenor),
      bungaRate: annualRatePercent,
    };
  }

  const i = annualRatePercent / 1200;
  const power = Math.pow(1 + i, tenor);
  const monthlyInstallment = Math.ceil((amount * (i * power)) / (power - 1));
  const totalRepayment = monthlyInstallment * tenor;
  const interestAmount = totalRepayment - amount;

  return {
    interestAmount,
    totalRepayment,
    monthlyInstallment,
    bungaRate: annualRatePercent,
  };
}

export function AddLoanDialogContent({onClose, onAdd}: Props) {
  const [selectedMember, setSelectedMember] = useState<SearchableItem | null>(null);
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('12');
  const [purpose, setPurpose] = useState('');
  const [loanDate, setLoanDate] = useState(todayIsoDate());

  const { data: membersRes } = useApiQuery<PaginatedResponse<MemberRow>>('/api/members?page=1&limit=1000');
  const { data: settings } = useApiQuery<SettingsData>('/api/settings');
  
  const members = membersRes?.data || [];
  const bungaRate = parseFloat(settings?.bungaPinjaman || '0') || 0;

  const memberItems: SearchableItem[] = useMemo(() => {
    return members.map(m => ({ id: m.id, label: m.name }));
  }, [members]);

  const memberSearchSource: SearchSource<SearchableItem> = {
    search: (query: string) =>
      memberItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    bootstrap: () => memberItems,
  };

  const parsedAmount = parseAmountInput(amount);
  const parsedTenor = parseInt(tenor, 10) || 12;
  const simulation = useMemo(
    () => simulateAnnuity(parsedAmount, parsedTenor, bungaRate),
    [parsedAmount, parsedTenor, bungaRate]
  );

  const handleSave = () => {
    if (!selectedMember || parsedAmount <= 0 || !loanDate) return;
    onAdd({
      memberId: selectedMember.id,
      name: selectedMember.label,
      amount: parsedAmount,
      tenor: parsedTenor,
      purpose,
      status: 'Menunggu',
      loanDate,
    });
    onClose();
  };

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Tambah Pengajuan Pinjaman</Heading>
        <Text type="supporting" color="secondary">
          Masukkan detail pengajuan pinjaman. Tanggal bisa diisi mundur untuk data historis.
        </Text>
      </VStack>
      
      <VStack gap={3}>
        <Typeahead
          label="Pilih Anggota"
          placeholder="Cari anggota..."
          searchSource={memberSearchSource}
          value={selectedMember}
          onChange={setSelectedMember}
          hasEntriesOnFocus
        />
        <TextInput
          label="Jumlah Pinjaman (Rp)"
          type="text"
          value={amount}
          onChange={(raw) => setAmount(formatAmountInput(raw))}
          placeholder="Contoh: 5.000.000"
          description="Pemisah ribuan ditambahkan otomatis"
        />
        <TextInput
          label="Tenor (Bulan)"
          type="text"
          value={tenor}
          onChange={(raw) => setTenor(raw.replace(/\D/g, ''))}
          placeholder="12"
        />
        <TextInput
          label="Tujuan Pinjaman"
          value={purpose}
          onChange={setPurpose}
          placeholder="Contoh: Modal Usaha"
        />
        <DateInput
          label="Tanggal Pinjaman"
          description="Tanggal pengajuan/pencairan. Bisa diisi mundur untuk data lama."
          value={loanDate}
          onChange={(val) => setLoanDate(val ?? todayIsoDate())}
          max={todayIsoDate()}
          isRequired
        />
      </VStack>

      <VStack
        gap={2}
        style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-background-secondary, var(--color-background-body))',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--color-border-primary, var(--color-border, #e5e7eb))',
          width: '100%',
        }}
      >
        <Text type="body" weight="bold">
          Simulasi Anuitas
          {simulation ? ` (Bunga ${simulation.bungaRate}% p.a.)` : ''}
        </Text>
        {!simulation ? (
          <Text type="supporting" color="secondary">
            Isi jumlah pinjaman di atas untuk melihat estimasi bunga dan angsuran.
          </Text>
        ) : (
          <>
            {bungaRate <= 0 && (
              <Text type="supporting" color="secondary">
                Bunga pinjaman di Pengaturan saat ini 0%. Ubah di Pengaturan → Bunga Pinjaman jika perlu.
              </Text>
            )}
            <HStack hAlign="space-between" style={{ width: '100%' }}>
              <Text type="supporting" color="secondary">Pokok Pinjaman</Text>
              <Text type="body" weight="semibold">{formatRp(parsedAmount)}</Text>
            </HStack>
            <HStack hAlign="space-between" style={{ width: '100%' }}>
              <Text type="supporting" color="secondary">Total Bunga ({parsedTenor} bln)</Text>
              <Text type="body" weight="semibold">{formatRp(simulation.interestAmount)}</Text>
            </HStack>
            <HStack
              hAlign="space-between"
              style={{
                width: '100%',
                borderTop: '1px dashed var(--color-border-primary, #e5e7eb)',
                paddingTop: 'var(--spacing-2)',
                marginTop: 'var(--spacing-1)',
              }}
            >
              <Text type="body" weight="bold">Total Pengembalian</Text>
              <Text type="body" weight="bold" color="accent">{formatRp(simulation.totalRepayment)}</Text>
            </HStack>
            <HStack hAlign="space-between" style={{ width: '100%' }}>
              <Text type="body" weight="bold">Angsuran per Bulan</Text>
              <Text type="body" weight="bold" color="accent">
                {formatRp(simulation.monthlyInstallment)} / bln
              </Text>
            </HStack>
          </>
        )}
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
