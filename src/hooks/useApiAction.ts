import { useToast } from '@astryxdesign/core/Toast';

export function useApiAction() {
  const toast = useToast();
  
  const execute = async <T,>(
    apiCall: () => Promise<T>,
    options: {
      successMsg?: string;
      errorMsg?: string;
      onSuccess?: (data: T) => void;
      onError?: (err: Error) => void;
      onFinally?: () => void;
    }
  ) => {
    try {
      const data = await apiCall();
      if (options.successMsg) {
        toast.show({ body: options.successMsg, type: 'info' });
      }
      options.onSuccess?.(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      if (options.errorMsg) {
        toast.show({ body: options.errorMsg, type: 'error' });
      } else {
        toast.show({ body: message, type: 'error' });
      }
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      options.onFinally?.();
    }
  };

  return { execute };
}
