import { semanticColors } from './tokens';

/**
 * Chart theming utilities for Recharts integration.
 * Ensures charts respect dark/light mode and use semantic tokens.
 */

export const chartColors = {
  // Categorical colors for different data series
  categorical: [
    semanticColors.dataBlue,
    semanticColors.dataOrange,
    semanticColors.dataGreen,
    semanticColors.dataPurple,
    semanticColors.dataPink,
  ],

  // Semantic colors for specific meanings
  simpanan: semanticColors.dataBlue,
  pinjaman: semanticColors.dataOrange,
  success: semanticColors.success,
  error: semanticColors.error,

  // Chart UI elements
  grid: 'var(--color-border, rgba(5, 54, 89, 0.1))',
  axis: 'var(--color-text-secondary, #4E606F)',
  tooltip: {
    background: 'var(--color-background-primary, #fff)',
    border: 'var(--color-border-primary, #e5e7eb)',
    text: 'var(--color-text-primary, #1f2937)',
  },
};

/**
 * Get color by index for multi-series charts.
 */
export function getCategoricalColor(index: number): string {
  return chartColors.categorical[index % chartColors.categorical.length];
}

/**
 * Recharts CartesianGrid props with theme support.
 */
export function getThemedGridProps() {
  return {
    stroke: chartColors.grid,
    strokeDasharray: '3 3',
  };
}

/**
 * Recharts XAxis/YAxis props with theme support.
 */
export function getThemedAxisProps() {
  return {
    tick: { fill: chartColors.axis },
    tickLine: { stroke: chartColors.axis },
  };
}

/**
 * Recharts Tooltip contentStyle with theme support.
 */
export function getThemedTooltipProps() {
  return {
    contentStyle: {
      backgroundColor: chartColors.tooltip.background,
      border: `1px solid ${chartColors.tooltip.border}`,
      borderRadius: '6px',
      color: chartColors.tooltip.text,
    },
  };
}
