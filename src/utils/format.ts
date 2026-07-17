export function formatRp(value: number | undefined | null): string {
  if (value == null) return 'Rp 0';
  return 'Rp ' + value.toLocaleString('id-ID');
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString; // fallback if invalid
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format a free-typed money string with Indonesian thousand separators (.).
 * Keeps an optional leading minus for withdrawals. Digits only otherwise.
 * Example: "1000000" → "1.000.000", "-50000" → "-50.000"
 */
export function formatAmountInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const negative = trimmed.startsWith('-');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return negative ? '-' : '';

  // Strip leading zeros but keep a single zero
  const normalized = digits.replace(/^0+(?=\d)/, '');
  const formatted = Number(normalized).toLocaleString('id-ID');
  return negative ? `-${formatted}` : formatted;
}

/** Parse a thousand-separated money string back to an integer (may be negative). */
export function parseAmountInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-') return 0;

  const negative = trimmed.startsWith('-');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return 0;

  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}
