export function parsePagination(pageStr?: string, limitStr?: string) {
  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;
  return {
    page: Math.max(1, parseInt(pageStr || '1') || 1),
    limit: Math.min(MAX_LIMIT, Math.max(1, parseInt(limitStr || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
  };
}
