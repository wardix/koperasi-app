# Design System Refactor - Week 1 Implementation Guide

> Quick reference untuk developer yang mengerjakan Week 1 design system refactor

## 📦 Setup

```bash
# Pastikan dependencies up-to-date
bun install

# Buat folder design
mkdir -p src/design

# Test bahwa development server jalan
bun run dev
```

## 🔍 Quick Search Commands

Untuk menemukan semua hardcoded colors:

```bash
# Cari semua hex colors
grep -r "#[0-9a-fA-F]\{3,6\}" src/ --include="*.tsx" --include="*.ts"

# Cari semua rgb/rgba
grep -r "rgb\|rgba" src/ --include="*.tsx" --include="*.ts"

# Cari semua var() dengan fallback hardcoded
grep -r "var(--.*,\s*[#rgb]" src/ --include="*.tsx" --include="*.ts"

# Count total instances per file
grep -r "var(--color" src/ --include="*.tsx" -c | sort -t: -k2 -nr | head -20
```

## 📝 Search & Replace Patterns

### Pattern 1: Error Text dengan Inline Style

**Search:**
```tsx
<Text type="supporting" color="error" style={{ color: 'var(--color-text-critical, red)' }}>
```

**Replace:**
```tsx
<Text type="supporting" color="critical">
```

**Files affected:**
- `src/components/AddMemberDialog.tsx`
- `src/components/AddLoanDialog.tsx`
- `src/components/EditMemberDialog.tsx`
- `src/components/ApproveLoanDialog.tsx`

---

### Pattern 2: Success/Error Colors di NPL & Cashflow

**Search:**
```tsx
style={{ color: 'var(--color-success, #10b981)' }}
```

**Replace:**
```tsx
color="success"
```

**Atau jika inline style diperlukan:**
```tsx
import { semanticColors } from '../design/tokens';
// ...
style={{ color: semanticColors.success }}
```

---

### Pattern 3: Chart Colors

**Search:**
```tsx
const COLORS = ['#0171E3', '#EB6E00', '#0B991F', '#6B1EFD', '#E30171'];
```

**Replace:**
```tsx
import { semanticColors } from '../design/tokens';

const COLORS = [
  semanticColors.dataBlue,
  semanticColors.dataOrange,
  semanticColors.dataGreen,
  semanticColors.dataPurple,
  semanticColors.dataPink,
];
```

**Files affected:**
- `src/pages/SHU.tsx`
- `src/pages/Reports.tsx` (potentially)

---

### Pattern 4: Background & Border Inline Styles

**Search:**
```tsx
style={{ 
  backgroundColor: 'var(--color-background-secondary, #f9fafb)',
  border: '1px solid var(--color-border-primary, #e5e7eb)',
}}
```

**Option 1 (preferred):** Remove inline style, use Astryx component variant
```tsx
// Check if Card/Box has variant prop
<Card variant="subtle">
```

**Option 2:** Use tokens
```tsx
import { semanticColors } from '../design/tokens';

style={{ 
  backgroundColor: semanticColors.bgSecondary,
  border: `1px solid ${semanticColors.borderPrimary}`,
}}
```

---

## 🎨 Token Usage Examples

### Colors

```tsx
import { semanticColors, getCashflowColor, getStatusColor } from '../design/tokens';

// Status colors
<Badge color={getStatusColor('success')}>Aktif</Badge>
<Text color="critical">{error.message}</Text>

// Dynamic colors
<Text style={{ color: getCashflowColor(transaction.type) }}>
  {formatRp(transaction.amount)}
</Text>

// Chart colors
<Bar dataKey="simpanan" fill={semanticColors.dataBlue} />
<Bar dataKey="pinjaman" fill={semanticColors.dataOrange} />
```

### Spacing & Radius

```tsx
import { spacing, radius } from '../design/tokens';

<VStack gap={4}> {/* Astryx built-in spacing */}
  <Card style={{ 
    padding: spacing.md,
    borderRadius: radius.lg 
  }}>
    {/* content */}
  </Card>
</VStack>
```

---

## 🧪 Testing Strategy

### Visual Regression Checklist

1. **Before refactor:** Take screenshots
```bash
# Manual: ambil screenshot untuk setiap halaman
# - Dashboard (light & dark)
# - Members list (light & dark)
# - Loans list (light & dark)
# - NPL page (light & dark)
# - Cashflow (light & dark)
# - Reports (light & dark)
# - SHU (light & dark)
```

2. **After refactor:** Compare screenshots
   - Seharusnya 100% identical
   - Jika ada perbedaan, pastikan itu improvement (bukan regression)

### Functional Testing

```bash
# Start dev server
bun run dev

# Test checklist (manual):
# 1. Toggle dark mode → semua warna berubah smooth
# 2. Form validation → error text merah & terbaca
# 3. Toast notifications → success hijau, error merah
# 4. Charts → warna konsisten dan distinct
# 5. NPL ratio colors → conditional colors bekerja
# 6. Cashflow inflow/outflow → hijau/merah sesuai type
```

---

## 🚨 Common Pitfalls

### ❌ Pitfall 1: Salah Props Name

```tsx
// ❌ WRONG - "error" bukan valid color prop di Astryx
<Text color="error">

// ✅ CORRECT - gunakan "critical"
<Text color="critical">
```

### ❌ Pitfall 2: Over-nesting Inline Styles

```tsx
// ❌ WRONG - inline style masih ada, token tidak terpakai
<div style={{ backgroundColor: '#f9fafb' }}>

// ✅ CORRECT - gunakan semantic token
import { semanticColors } from '../design/tokens';
<div style={{ backgroundColor: semanticColors.bgSecondary }}>
```

### ❌ Pitfall 3: Lupa Import

```tsx
// ❌ WRONG - ReferenceError: semanticColors is not defined
const color = semanticColors.success;

// ✅ CORRECT
import { semanticColors } from '../design/tokens';
const color = semanticColors.success;
```

### ❌ Pitfall 4: Case Sensitivity

```tsx
// ❌ WRONG - Ada typo atau case salah
semanticColors.Success  // undefined!

// ✅ CORRECT
semanticColors.success
```

---

## 📊 Progress Tracking

**Total files to refactor:** 19 files  
**Total hardcoded color instances:** 166

| File | Instances | Status |
|------|-----------|--------|
| `src/pages/Reports.tsx` | 60 | ⬜ Todo |
| `src/components/LoanDetailDialog.tsx` | 15 | ⬜ Todo |
| `src/components/ImportSavingsDialog.tsx` | 13 | ⬜ Todo |
| `src/pages/SHU.tsx` | 11 | ⬜ Todo |
| `src/components/AddMemberDialog.tsx` | 11 | ⬜ Todo |
| `src/components/AddLoanDialog.tsx` | 10 | ⬜ Todo |
| `src/pages/Settings.tsx` | 8 | ⬜ Todo |
| `src/pages/MemberPortal.tsx` | 8 | ⬜ Todo |
| `src/App.tsx` | 7 | ⬜ Todo |
| `src/pages/NPL.tsx` | 5 | ⬜ Todo |
| `src/pages/AuditLog.tsx` | 5 | ⬜ Todo |
| `src/pages/Cashflow.tsx` | 4 | ⬜ Todo |
| `src/components/ApproveLoanDialog.tsx` | 3 | ⬜ Todo |
| Others (8 files) | 6 | ⬜ Todo |

**Legend:**
- ⬜ Todo
- 🔄 In Progress
- ✅ Done
- ⚠️ Needs Review

Update status setelah selesai refactor per file!

---

## 🤝 Getting Help

**Stuck on Astryx component props?**
- Docs: https://astryx.atmeta.com/docs/core
- Check existing usage di `src/components/Shell.tsx` (good example)

**Warna tidak berubah saat dark mode?**
- Pastikan menggunakan `var(--color-*)` bukan hardcoded hex
- Check apakah token ada di neutralTheme

**Test visual gagal?**
- Screenshot before/after dan tanyakan di PR review
- Kemungkinan fallback color berbeda dari token default

**Questions?**
- Comment di GitHub issue
- Mention @frontend-team di PR

---

## ✅ PR Checklist

Before submit PR:

- [ ] `src/design/tokens.ts` created
- [ ] `src/design/theme.ts` created
- [ ] No hardcoded hex colors (`grep` returns 0 results)
- [ ] `bun run dev` starts without errors
- [ ] `bun run build` succeeds
- [ ] `bun run lint` passes
- [ ] All manual tests passed
- [ ] Screenshots attached (before/after)
- [ ] PR description explains what changed

**PR Title format:**
```
[Design System] Week 1 - Implement design tokens and remove hardcoded colors
```

**PR Description template:**
```markdown
## What
Implements centralized design tokens and removes all hardcoded color values.

## Changes
- Created `src/design/tokens.ts` with semantic color tokens
- Created `src/design/theme.ts` for future customization
- Refactored 19 files, removing 166 hardcoded color instances
- Replaced inline styles with Astryx component props where possible

## Testing
- ✅ Manual testing: all pages work in light & dark mode
- ✅ Visual regression: no unexpected changes
- ✅ Form validation errors display correctly
- ✅ Charts maintain consistent colors

## Screenshots
[Attach before/after screenshots]

Closes #[issue-number]
```

Good luck! 🚀
