'use client';

import React from 'react';
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  HStack,
  VStack,
  StackItem,
} from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { FeedbackSettings } from '../components/settings/FeedbackSettings';

export default function Feedbacks() {
  return (
    <Layout>
      <LayoutHeader divider>
        <HStack gap={3} vAlign="center">
          <StackItem size="fill">
            <VStack gap={0}>
              <HStack gap={2} vAlign="center">
                <Icon icon={ChatBubbleLeftRightIcon} size="md" color="primary" />
                <Heading level={1}>Kotak Masukan & Bug</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Kelola feedback, laporan kendala, dan usulan fitur dari pengguna &amp; anggota
              </Text>
            </VStack>
          </StackItem>
        </HStack>
      </LayoutHeader>
      <LayoutContent padding={4}>
        <VStack gap={6} style={{ paddingBottom: '80px' }}>
          <FeedbackSettings hideHeader />
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
