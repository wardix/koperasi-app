import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {formatAmountInput, parseAmountInput} from '../utils/format';

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export type SavingsMutationPayload = {
  additionalSavings: number;
  savingsType: 'pokok' | 'wajib' | 'sukarela';
  transactionDate: string;
};

interface Props {
  onClose: () => void;
  onSave: (payload: SavingsMutationPayload) => void;
}

export function UpdateSavingsDialogContent({onClose, onSave}: Props) {
  const [amount, setAmount] = useState('');
  const [savingsType, setSavingsType] = useState<'pokok' | 'wajib' | 'sukarela'>('sukarela');
  const [transactionDate, setTransactionDate] = useState<string>(todayIsoDate());

  const handleAmountChange = (raw: string) => {
    setAmount(formatAmountInput(raw));
  };

  const handleSave = () => {
    const additionalSavings = parseAmountInput(amount);
    if (!amount || amount === '-' || additionalSavings === 0 || !transactionDate) return;
    onSave({
      additionalSavings,
      savingsType,
      transactionDate,
    });
    onClose();
  };

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Mutasi Simpanan</Heading>
        <Text type="supporting" color="secondary">
          Masukkan nominal setor (positif) atau tarik (negatif), jenis simpanan, dan tanggal transaksi.
          Tanggal bisa diisi mundur untuk data historis.
        </Text>
      </VStack>
      
      <VStack gap={3}>
        <Selector
          label="Jenis Simpanan"
          value={savingsType}
          onChange={(val) => setSavingsType(val as 'pokok' | 'wajib' | 'sukarela')}
          options={[
            {value: 'sukarela', label: 'Simpanan Sukarela'},
            {value: 'wajib', label: 'Simpanan Wajib'},
            {value: 'pokok', label: 'Simpanan Pokok'}
          ]}
        />
        <TextInput
          label="Nominal (Rp)"
          type="text"
          value={amount}
          onChange={handleAmountChange}
          placeholder="Contoh: 1.000.000 (Setor) atau -50.000 (Tarik)"
          description="Pemisah ribuan ditambahkan otomatis. Awali dengan - untuk penarikan."
        />
        <DateInput
          label="Tanggal Transaksi"
          description="Pilih tanggal saat setor/tarik benar-benar terjadi"
          value={transactionDate}
          onChange={(val) => setTransactionDate(val ?? todayIsoDate())}
          max={todayIsoDate()}
          isRequired
        />
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
