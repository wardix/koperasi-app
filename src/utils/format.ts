export function formatRp(value: number | undefined | null): string {
  if (value == null) return 'Rp 0';
  return 'Rp ' + value.toLocaleString('id-ID');
}
