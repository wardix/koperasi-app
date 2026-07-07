import { Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';

export default function ComingSoon() {
  return (
    <Layout
      height="auto"
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            <Heading level={3}>Segera Hadir</Heading>
            <Card>
              <VStack gap={4} hAlign="center" style={{ padding: '40px 0', textAlign: 'center' }}>
                <Heading level={4}>Halaman Sedang Dalam Pengembangan</Heading>
                <Text type="supporting" color="secondary">
                  Fitur ini masih dalam tahap pengerjaan dan akan segera tersedia pada pembaruan berikutnya.
                </Text>
              </VStack>
            </Card>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
