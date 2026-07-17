import { ReactNode } from 'react';
import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@astryxdesign/core/Button';

interface DataStateViewProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  errorTitle?: string;
  loadingComponent?: ReactNode;
  children: ReactNode;
}

export function DataStateView({ isLoading, error, onRetry, errorTitle = 'Gagal Memuat Data', loadingComponent, children }: DataStateViewProps) {
  if (isLoading) {
    if (loadingComponent) return <>{loadingComponent}</>;
    return (
      <Center style={{height: '100%'}}>
        <Spinner size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center style={{height: '100%'}}>
        <EmptyState
          icon={<ExclamationCircleIcon width={48} height={48} />}
          title={errorTitle}
          description={error}
          actions={onRetry ? <Button label="Coba Lagi" onClick={onRetry} /> : undefined}
        />
      </Center>
    );
  }

  return <>{children}</>;
}
