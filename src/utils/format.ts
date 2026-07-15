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
