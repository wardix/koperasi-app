import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../services/api';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface UseInfiniteScrollOptions {
  limit?: number;
}

interface UseInfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: string | null;
  sentinelRef: (node: HTMLElement | null) => void;
  refetch: () => void;
}

/**
 * Hook for infinite scrolling using the IntersectionObserver API.
 * The API must follow the { data: T[], total, page, limit } shape.
 */
export function useInfiniteScroll<T>(
  baseUrl: string,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult<T> {
  const { limit = 20 } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const resetRef = useRef(0); // bump to reset

  const hasMore = items.length < total;

  const fetchPage = useCallback(async (pageNum: number, reset: boolean) => {
    if (reset) setIsLoading(true);
    else setIsFetchingMore(true);
    setError(null);

    try {
      const sep = baseUrl.includes('?') ? '&' : '?';
      const res = await apiFetch(`${baseUrl}${sep}page=${pageNum}&limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; data: PaginatedResponse<T> };
      const payload = json.data;

      setItems(prev => reset ? payload.data : [...prev, ...payload.data]);
      setTotal(payload.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [baseUrl, limit]);

  // Initial load or reset
  useEffect(() => {
    setPage(1);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRef.current, baseUrl]);

  // Fetch next page when page increments (but not on the initial 1)
  useEffect(() => {
    if (page === 1) return;
    fetchPage(page, false);
  }, [page, fetchPage]);

  // Sentinel ref: when it enters the viewport, load next page
  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isFetchingMore && !isLoading) {
        setPage(prev => prev + 1);
      }
    }, { threshold: 0.1 });

    observerRef.current.observe(node);
  }, [isFetchingMore, isLoading]);

  const refetch = useCallback(() => {
    resetRef.current += 1;
    setPage(1);
    fetchPage(1, true);
  }, [fetchPage]);

  return { items, isLoading, isFetchingMore, hasMore, error, sentinelRef, refetch };
}
