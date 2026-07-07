import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Center } from '@astryxdesign/core/Center';
import { VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Center style={{ height: '100vh', backgroundColor: '#f9fafb' }}>
          <VStack gap={4} style={{ alignItems: 'center', textAlign: 'center', maxWidth: 400 }}>
            <Heading level={2} color="error">Terjadi Kesalahan</Heading>
            <Text type="body" color="secondary">
              Maaf, aplikasi mengalami masalah tak terduga. Silakan muat ulang halaman.
            </Text>
            <Button 
              label="Muat Ulang" 
              onClick={() => window.location.reload()} 
            />
          </VStack>
        </Center>
      );
    }

    return this.props.children;
  }
}
