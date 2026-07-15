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
        toast({ body: options.successMsg, type: 'info' });
      }
      options.onSuccess?.(data);
    } catch (err: unknown) {
      console.error("API Action Error:", err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      
      const mapFriendlyErrorMessage = (msg: string) => {
        if (msg.includes('Failed to fetch') || msg.includes('Network Error')) return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
        if (msg.includes('Unauthorized') || msg.includes('401')) return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
        if (msg.includes('Not Found') || msg.includes('404')) return 'Data yang diminta tidak ditemukan.';
        if (msg.includes('Internal Server Error') || msg.includes('500')) return 'Terjadi kesalahan internal pada server.';
        if (msg.includes('Bad Request') || msg.includes('400')) return 'Permintaan tidak valid. Silakan periksa kembali data yang dimasukkan.';
        return msg;
      };

      if (options.errorMsg) {
        toast({ body: options.errorMsg, type: 'error' });
      } else {
        toast({ body: mapFriendlyErrorMessage(message), type: 'error' });
      }
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      options.onFinally?.();
    }
  };

  return { execute };
}
