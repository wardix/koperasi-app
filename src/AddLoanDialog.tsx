import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import type {LoanRow} from './Loans';

interface Props {
  onClose: () => void;
  onAdd: (loan: LoanRow) => void;
}

export function AddLoanDialogContent({onClose, onAdd}: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('12 Bulan');
  const [purpose, setPurpose] = useState('');

  const handleSave = () => {
    if (!name || !amount) return;
    onAdd({
      id: Date.now().toString(),
      name,
      amount: Number(amount) || 0,
      tenor,
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
        <TextInput
          label="Nama Peminjam"
          value={name}
          onChange={setName}
          placeholder="Nama Anggota"
        />
        <TextInput
          label="Jumlah Pinjaman (Rp)"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Contoh: 5000000"
        />
        <TextInput
          label="Tenor"
          value={tenor}
          onChange={setTenor}
          placeholder="12 Bulan"
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
