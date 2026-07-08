import { useToast } from '@astryxdesign/core/Toast';

export function useApiAction() {
  const toast = useToast();
  
  const execute = async <T,>(
    apiCall: () => Promise<T>,
    options: {
      successMsg?: string;
      errorMsg?: string;
      onSuccess?: (data: T) => void;
      onFinally?: () => void;
    }
  ) => {
    try {
      const data = await apiCall();
      if (options.successMsg) {
        toast.show({ body: options.successMsg, type: 'info' });
      }
      options.onSuccess?.(data);
    } catch (err: any) {
      console.error(err);
      if (options.errorMsg) {
        toast.show({ body: options.errorMsg, type: 'error' });
      }
    } finally {
      options.onFinally?.();
    }
  };

  return { execute };
}
