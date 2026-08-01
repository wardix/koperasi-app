import { neutralTheme } from '@astryxdesign/theme-neutral';

/**
 * Custom theme untuk Koperasi Maju Bersama
 * Extends neutralTheme dengan brand colors
 *
 * Cara customize:
 * - Override token spesifik dengan menambahkan key di bawah
 * - Contoh: primary: { 500: '#YourBrandColor' }
 * - Referensi token: https://astryx.atmeta.com/docs/tokens/colors
 */
export const koperasiTheme = {
  ...neutralTheme,
  // Override specific tokens jika diperlukan
  // Untuk sekarang gunakan neutralTheme as-is
  // Customization bisa dilakukan nanti sesuai kebutuhan branding
};
