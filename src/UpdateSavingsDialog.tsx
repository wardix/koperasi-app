import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';

interface Props {
  onClose: () => void;
  onSave: (additionalSavings: string) => void;
}

export function UpdateSavingsDialogContent({onClose, onSave}: Props) {
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    if (!amount) return;
    onSave(amount);
    onClose();
  };

  return (
    <VStack padding={4} gap={4}>
      <VStack gap={1}>
        <Heading level={3}>Setor Simpanan</Heading>
        <Text type="supporting" color="secondary">
          Masukkan nominal tambahan yang disetorkan oleh anggota.
        </Text>
      </VStack>
      
      <VStack gap={3}>
        <TextInput
          label="Nominal Setoran (Rp)"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Contoh: 100000"
        />
      </VStack>

      <HStack gap={2} hAlign="end">
        <Button label="Batal" variant="secondary" onClick={onClose} />
        <Button label="Simpan" variant="primary" onClick={handleSave} />
      </HStack>
    </VStack>
  );
}
