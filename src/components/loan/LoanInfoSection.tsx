'use client';

import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { formatRp } from '../../utils/format';

interface LoanInfoSectionProps {
  pokok: number;
  biayaAdmin: number;
  totalHutang: number;
  remainingDebt: number;
}

const cardStyle: React.CSSProperties = {
  flex: 1,
  padding: 16,
  backgroundColor: 'var(--color-background-secondary)',
  borderRadius: 8,
};

/**
 * Summary cards: Pokok, Total Biaya Admin, Total Hutang, Sisa Hutang.
 */
export function LoanInfoSection({
  pokok,
  biayaAdmin,
  totalHutang,
  remainingDebt,
}: LoanInfoSectionProps) {
  return (
    <VStack gap={4}>
      <HStack gap={4}>
        <VStack gap={1} style={cardStyle}>
          <Text type="supporting" color="secondary">Pokok</Text>
          <Heading level={3}>{formatRp(pokok)}</Heading>
        </VStack>
        <VStack gap={1} style={{ ...cardStyle, padding: 12 }}>
          <Text type="supporting" color="secondary">Total Biaya Admin</Text>
          <Heading level={3}>{formatRp(biayaAdmin)}</Heading>
        </VStack>
      </HStack>
      <HStack gap={4}>
        <VStack gap={1} style={cardStyle}>
          <Text type="supporting" color="secondary">Total Hutang</Text>
          <Heading level={3}>{formatRp(totalHutang)}</Heading>
        </VStack>
        <VStack gap={1} style={cardStyle}>
          <Text type="supporting" color="secondary">Sisa Hutang</Text>
          <Heading level={3}>{formatRp(Math.max(0, remainingDebt))}</Heading>
        </VStack>
      </HStack>
    </VStack>
  );
}
