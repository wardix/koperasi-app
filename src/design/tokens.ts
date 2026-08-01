/**
 * Design tokens untuk Sistem Informasi Koperasi
 * Menggunakan Astryx Design System semantic tokens sebagai base
 */

export const semanticColors = {
  // Status colors
  success: 'var(--color-success-500)',
  error: 'var(--color-critical-500)',
  warning: 'var(--color-warning-500)',
  info: 'var(--color-primary-500)',

  // Text colors
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textCritical: 'var(--color-text-critical)',
  textSuccess: 'var(--color-text-success)',

  // Background colors
  bgPrimary: 'var(--color-background-primary)',
  bgSecondary: 'var(--color-background-secondary)',
  bgSubtle: 'var(--color-background-subtle)',

  // Border colors
  borderPrimary: 'var(--color-border-primary)',
  border: 'var(--color-border)',

  // Data visualization (for charts)
  dataBlue: 'var(--color-data-categorical-blue, #0171E3)',
  dataOrange: 'var(--color-data-categorical-orange, #EB6E00)',
  dataGreen: 'var(--color-data-categorical-green, #0B991F)',
  dataPurple: 'var(--color-data-categorical-purple, #6B1EFD)',
  dataPink: 'var(--color-data-categorical-pink, #E30171)',
} as const;

export const spacing = {
  xs: 'var(--spacing-2)',
  sm: 'var(--spacing-3)',
  md: 'var(--spacing-4)',
  lg: 'var(--spacing-6)',
  xl: 'var(--spacing-8)',
} as const;

export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
} as const;

// Helper functions
export function getStatusColor(status: 'success' | 'error' | 'warning' | 'info'): string {
  return semanticColors[status];
}

export function getCashflowColor(type: 'inflow' | 'outflow'): string {
  return type === 'inflow' ? semanticColors.dataGreen : semanticColors.error;
}
