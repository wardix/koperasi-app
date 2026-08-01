import { Badge } from '@astryxdesign/core/Badge';

export type StatusType =
  | 'Aktif'
  | 'Pasif'
  | 'Menunggu'
  | 'Disetujui'
  | 'Ditolak'
  | 'Lunas'
  | 'Macet'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

export interface StatusBadgeProps {
  status: StatusType;
  /** Override default label (useful for translations) */
  label?: string;
}

type BadgeVariant = 'success' | 'neutral' | 'warning' | 'critical' | 'info';

const statusConfig: Record<StatusType, { variant: BadgeVariant }> = {
  // Member status
  Aktif: { variant: 'success' },
  Pasif: { variant: 'neutral' },

  // Loan status
  Menunggu: { variant: 'warning' },
  Disetujui: { variant: 'info' },
  Ditolak: { variant: 'critical' },
  Lunas: { variant: 'success' },
  Macet: { variant: 'critical' },

  // Generic status
  success: { variant: 'success' },
  error: { variant: 'critical' },
  warning: { variant: 'warning' },
  info: { variant: 'info' },
};

/**
 * Consistent status badge for members, loans, and other entities.
 * Automatically maps status to appropriate semantic color.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { variant: 'neutral' };

  return <Badge variant={config.variant} label={label ?? status} />;
}
