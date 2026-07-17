import {useState, useMemo} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {apiFetch} from '../config';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import {useApiQuery} from '../hooks/useApiQuery';
import type {PaginatedResponse, MemberRow, LoanRow, SettingsData} from '../shared/types';
import {formatAmountInput, formatRp, parseAmountInput} from '../utils/format';

interface Props {
  onClose: () => void;
  onAdd: (loan: Omit<LoanRow, 'id'>) => void;
}

export function AddLoanDialogContent({onClose, onAdd}: Props) {
  const [selectedMember, setSelectedMember] = useState<SearchableItem | null>(null);
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('12');
  const [purpose, setPurpose] = useState('');

  const { data: membersRes } = useApiQuery<PaginatedResponse<MemberRow>>('/api/members?page=1&limit=1000');
  const { data: settings } = useApiQuery<SettingsData>('/api/settings');
  
  const members = membersRes?.data || [];
  const bungaRate = parseFloat(settings?.bungaPinjaman || '1.5');

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

  const simulation = useMemo(() => {
    if (parsedAmount <= 0) return null;
    const i = bungaRate / 1200; // Annual rate to monthly rate decimal
    const power = Math.pow(1 + i, parsedTenor);
    const monthlyInstallment = Math.ceil(parsedAmount * (i * power) / (power - 1));
    const totalRepayment = monthlyInstallment * parsedTenor;
    const interestAmount = totalRepayment - parsedAmount;

    return {
      interestAmount,
      totalRepayment,
      monthlyInstallment,
      bungaRate
    };
  }, [parsedAmount, parsedTenor, bungaRate]);

  const handleSave = () => {
    if (!selectedMember || parsedAmount <= 0) return;
    onAdd({
      memberId: selectedMember.id,
      name: selectedMember.label,
      amount: parsedAmount,
      tenor: parsedTenor,
      purpose,
      status: 'Menunggu',
    });
    onClose();
  };

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Tambah Pengajuan Pinjaman</Heading>
        <Text type="supporting" color="secondary">
          Masukkan detail pengajuan pinjaman baru.
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
      </VStack>

      {simulation && (
        <VStack gap={2} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <Text type="body" style={{ fontWeight: 600 }}>Simulasi Pinjaman Anuitas (Bunga {simulation.bungaRate}% p.a.):</Text>
          <HStack hAlign="space-between">
            <Text type="supporting" color="secondary">Pokok Pinjaman</Text>
            <Text type="body" style={{ fontWeight: 500 }}>{formatRp(parsedAmount)}</Text>
          </HStack>
          <HStack hAlign="space-between">
            <Text type="supporting" color="secondary">Total Bunga ({parsedTenor} bln)</Text>
            <Text type="body" style={{ fontWeight: 500 }}>{formatRp(simulation.interestAmount)}</Text>
          </HStack>
          <HStack hAlign="space-between" style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '8px', marginTop: '4px' }}>
            <Text type="body" style={{ fontWeight: 600 }}>Total Pengembalian</Text>
            <Text type="body" style={{ fontWeight: 700, color: 'var(--color-primary, #0171E3)' }}>{formatRp(simulation.totalRepayment)}</Text>
          </HStack>
          <HStack hAlign="space-between">
            <Text type="body" style={{ fontWeight: 600 }}>Angsuran per Bulan</Text>
            <Text type="body" style={{ fontWeight: 700, color: 'var(--color-success, #0B991F)' }}>{formatRp(simulation.monthlyInstallment)} / bln</Text>
          </HStack>
        </VStack>
      )}

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
