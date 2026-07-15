import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiQuery<T>(path: string): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const json = await api.get(path);
      setData(json as T);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err) || 'Terjadi kesalahan tidak terduga';
      if (msg.includes('Failed to fetch') || msg.includes('Network Error')) setError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
      else if (msg.includes('Unauthorized') || msg.includes('401')) setError('Sesi Anda telah berakhir. Silakan masuk kembali.');
      else if (msg.includes('Not Found') || msg.includes('404')) setError('Data yang diminta tidak ditemukan.');
      else if (msg.includes('Internal Server Error') || msg.includes('500')) setError('Terjadi kesalahan internal pada server.');
      else if (msg.includes('Bad Request') || msg.includes('400')) setError('Permintaan tidak valid. Silakan periksa kembali data yang dimasukkan.');
      else setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
