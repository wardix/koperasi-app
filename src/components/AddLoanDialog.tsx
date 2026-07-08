import {useState, useMemo} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {apiFetch} from '../config';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import {useApiQuery} from '../hooks/useApiQuery';
import type {PaginatedResponse, MemberRow, LoanRow} from '../shared/types';

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
  const members = membersRes?.data || [];

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

  const handleSave = () => {
    if (!selectedMember || !amount) return;
    onAdd({
      memberId: selectedMember.id,
      name: selectedMember.label,
      amount: Number(amount) || 0,
      tenor: parseInt(tenor) || 12,
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
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Contoh: 5000000"
        />
        <TextInput
          label="Tenor (Bulan)"
          type="number"
          value={tenor}
          onChange={setTenor}
          placeholder="12"
        />
        <TextInput
          label="Tujuan Pinjaman"
          value={purpose}
          onChange={setPurpose}
          placeholder="Contoh: Modal Usaha"
        />
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
