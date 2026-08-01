---
name: Design System Refactor - Week 1
about: Standardize design tokens and remove hardcoded colors
title: '[Design System] Implement centralized design tokens and remove hardcoded styles'
labels: enhancement, design-system, frontend, good-first-issue
assignees: ''
---

## 🎨 Deskripsi

Frontend saat ini menggunakan Astryx Design System tapi implementasinya tidak konsisten. Ada **166 instances** warna hardcoded di 19 file yang membuat maintenance sulit dan hasil visual tidak konsisten dengan theme.

**Masalah:**
- Warna semantic (success, error, warning) di-hardcode dengan value berbeda-beda
- Tidak ada centralized design tokens
- Inline styles redundan dan bentrok dengan Astryx theming
- Chart colors tidak terintegrasi dengan theme system

## 🎯 Goal Week 1

Membuat foundation design token system yang proper dan menghilangkan hardcoded colors dari codebase.

---

## ✅ Task List

### Task 1: Buat Design Token File
**File:** `src/design/tokens.ts`

**Konten:**
```typescript
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
  return type === 'inflow' ? semanticColors.success : semanticColors.error;
}
```

**Acceptance Criteria:**
- [ ] File `src/design/tokens.ts` dibuat dengan semua token semantic yang dibutuhkan
- [ ] Export konstan TypeScript dengan type safety (`as const`)
- [ ] Ada helper functions untuk common use cases

---

### Task 2: Buat Custom Koperasi Theme
**File:** `src/design/theme.ts`

**Konten:**
```typescript
import { neutralTheme } from '@astryxdesign/theme-neutral';

/**
 * Custom theme untuk Koperasi Maju Bersama
 * Extends neutralTheme dengan brand colors
 */
export const koperasiTheme = {
  ...neutralTheme,
  // Override specific tokens jika diperlukan
  // Untuk sekarang gunakan neutralTheme as-is
  // Customization bisa dilakukan nanti sesuai kebutuhan branding
};
```

**Acceptance Criteria:**
- [ ] File `src/design/theme.ts` dibuat
- [ ] Theme di-export dan siap digunakan di `main.tsx`
- [ ] Dokumentasi cara customize theme (comment dalam kode)

---

### Task 3: Replace Hardcoded Colors di Components

**Target files (prioritas tinggi):**
1. `src/components/AddMemberDialog.tsx` (11 instances)
2. `src/components/AddLoanDialog.tsx` (10 instances)
3. `src/components/ImportSavingsDialog.tsx` (13 instances)
4. `src/components/LoanDetailDialog.tsx` (15 instances)
5. `src/components/ApproveLoanDialog.tsx` (3 instances)
6. `src/components/EditMemberDialog.tsx` (1 instance)

**Pattern to replace:**

```tsx
// ❌ BEFORE
<Text type="supporting" color="error" style={{ color: 'var(--color-text-critical, red)' }}>
  {errors.name.message}
</Text>

// ✅ AFTER
<Text type="supporting" color="critical">
  {errors.name.message}
</Text>
```

```tsx
// ❌ BEFORE
style={{ 
  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
  border: '1px solid var(--color-border-primary, #e5e7eb)',
}}

// ✅ AFTER
// Gunakan Astryx component props, atau buat wrapper component
// Hindari inline styles sebisa mungkin
```

**Acceptance Criteria:**
- [ ] Semua error text menggunakan `color="critical"` prop, bukan inline style
- [ ] Tidak ada hardcoded color values (`#hex`, `rgb()`, dll) di components
- [ ] Inline styles dikurangi minimal 80% di target files
- [ ] Visual appearance tetap sama (no breaking changes)

---

### Task 4: Replace Colors di Pages

**Target files:**
1. `src/pages/Reports.tsx` (60 instances)
2. `src/pages/NPL.tsx` (5 instances)
3. `src/pages/Cashflow.tsx` (4 instances)
4. `src/pages/SHU.tsx` (11 instances)
5. `src/pages/Settings.tsx` (8 instances)
6. `src/pages/MemberPortal.tsx` (8 instances)
7. `src/pages/Savings.tsx` (1 instance)
8. `src/pages/LoansTx.tsx` (1 instance)

**Pattern examples:**

```tsx
// ❌ BEFORE
<Text type="body" style={{ color: 'var(--color-success, #10b981)' }}>
  {formatRp(item.paidAmount)}
</Text>

// ✅ AFTER
import { semanticColors } from '../design/tokens';
<Text type="body" color="success">
  {formatRp(item.paidAmount)}
</Text>
```

```tsx
// ❌ BEFORE
const COLORS = ['#0171E3', '#EB6E00', '#0B991F', '#6B1EFD', '#E30171'];

// ✅ AFTER
import { semanticColors } from '../design/tokens';
const COLORS = [
  semanticColors.dataBlue,
  semanticColors.dataOrange,
  semanticColors.dataGreen,
  semanticColors.dataPurple,
  semanticColors.dataPink,
];
```

**Acceptance Criteria:**
- [ ] Import `semanticColors` dari `src/design/tokens` di semua pages yang butuh
- [ ] Tidak ada hardcoded hex colors di pages
- [ ] Chart colors menggunakan tokens dari `semanticColors.data*`

---

### Task 5: Clean Up Custom CSS Variables

**File:** `src/index.css`

**Action:**
Audit dan dokumentasikan CSS custom properties yang bentrok dengan Astryx:
- `--text`, `--text-h`, `--bg`, `--border`, `--accent` → kemungkinan tidak dipakai atau bisa dihapus
- Verifikasi apakah ada yang masih digunakan dengan search codebase
- Jika masih dipakai, migrate ke Astryx tokens

**Acceptance Criteria:**
- [ ] Dokumentasi CSS vars yang masih dipakai (comment atau docs)
- [ ] Hapus CSS vars yang tidak terpakai
- [ ] Tidak ada bentrokan dengan Astryx token system

---

## 📸 Testing Checklist

**Manual testing required:**
- [ ] Dark mode toggle berfungsi normal (semua warna berubah dengan benar)
- [ ] Error messages tetap berwarna merah dan terbaca
- [ ] Success messages tetap berwarna hijau
- [ ] Charts di Dashboard, Reports, SHU tetap berwarna konsisten
- [ ] NPL page: warna merah untuk NPL ratio > 5%, kuning untuk > 2%, hijau untuk sisanya
- [ ] Cashflow: inflow hijau, outflow merah
- [ ] Form validation errors tampil dengan jelas

**Visual regression:**
- [ ] Screenshot before/after untuk halaman utama (Dashboard, Members, Loans)
- [ ] Tidak ada perubahan visual yang tidak diinginkan

---

## 📚 Resources

- [Astryx Theming Docs](https://astryx.atmeta.com/docs/theming)
- [Astryx Color Tokens](https://astryx.atmeta.com/docs/tokens/colors)
- [Design System Best Practices](https://astryx.atmeta.com/blog/how-astryx-works)

---

## 🔍 Definition of Done

- [ ] Semua 5 tasks di atas complete
- [ ] No hardcoded color values (`#hex`, `rgb`, dll) di component/page files
- [ ] All manual tests passed
- [ ] Dark mode works correctly
- [ ] PR reviewed dan merged
- [ ] No visual regression (confirm dengan screenshot comparison)

---

## 💡 Notes

- **Prioritas:** High (foundation untuk pekerjaan Week 2 & 3)
- **Estimated effort:** 6-8 jam
- **Breaking changes:** None (purely internal refactor)
- **Dependencies:** None

Jika ada pertanyaan atau butuh bantuan implementasi, mention @team-frontend di PR.
