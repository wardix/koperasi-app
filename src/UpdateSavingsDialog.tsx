import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';

interface Props {
  onClose: () => void;
  onSave: (additionalSavings: number, savingsType: "pokok" | "wajib" | "sukarela") => void;
}

export function UpdateSavingsDialogContent({onClose, onSave}: Props) {
  const [amount, setAmount] = useState('');
  const [savingsType, setSavingsType] = useState<"pokok" | "wajib" | "sukarela">("sukarela");

  const handleSave = () => {
    if (!amount) return;
    onSave(parseInt(amount, 10) || 0, savingsType);
    onClose();
  };

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Mutasi Simpanan</Heading>
        <Text type="supporting" color="secondary">
          Masukkan nominal setor (positif) atau tarik (negatif) beserta jenis simpanannya.
        </Text>
      </VStack>
      
      <VStack gap={3}>
        <Selector
          label="Jenis Simpanan"
          value={savingsType}
          onChange={(val) => setSavingsType(val as any)}
          options={[
            {value: 'sukarela', label: 'Simpanan Sukarela'},
            {value: 'wajib', label: 'Simpanan Wajib'},
            {value: 'pokok', label: 'Simpanan Pokok'}
          ]}
        />
        <TextInput
          label="Nominal (Rp)"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Contoh: 100000 (Setor) atau -50000 (Tarik)"
        />
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
