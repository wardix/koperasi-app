# Design System Refactor - Week 3 Implementation Guide

> Final polish: integration, optimization, and documentation

## 📦 Prerequisites

```bash
# Verify Week 1 & 2 completed
# - src/design/tokens.ts exists
# - Large components refactored
# - Common components (FormField, StatusBadge) exist

# Install any missing dev dependencies
bun install

# Start clean
git status # Should be clean or on feature branch
```

---

## 🎯 Week 3 Overview

**Philosophy:** "Polish & Document"

1. **Integrate** - Chart colors with tokens, consolidate theme
2. **Optimize** - Performance improvements (memoization, lazy loading)
3. **Document** - Comprehensive guides for team
4. **Polish** - Remove remaining inconsistencies

---

## 📝 Task 1: Chart Integration (2-3 hours)

### Step 1.1: Create Chart Theme Module

```bash
# Create the chart theme file
cat > src/design/chartTheme.ts << 'EOF'
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
  
  // Semantic colors
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

export function getCategoricalColor(index: number): string {
  return chartColors.categorical[index % chartColors.categorical.length];
}

export function getThemedGridProps() {
  return {
    stroke: chartColors.grid,
    strokeDasharray: '3 3',
  };
}

export function getThemedAxisProps() {
  return {
    tick: { fill: chartColors.axis },
    tickLine: { stroke: chartColors.axis },
  };
}

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
EOF
```

### Step 1.2: Update Dashboard Charts (App.tsx)

**Find & Replace Pattern:**

```tsx
// BEFORE
const chartColors = {
  simpanan: 'var(--color-data-categorical-blue, #0171E3)',
  pinjaman: 'var(--color-data-categorical-orange, #EB6E00)',
};

<CartesianGrid stroke="var(--color-border, rgba(5, 54, 89, 0.1))" strokeDasharray="3 3" />
<XAxis tick={{ fill: 'var(--color-text-secondary, #4E606F)' }} />
<Bar dataKey="simpanan" fill={chartColors.simpanan} />

// AFTER
import { chartColors, getThemedGridProps, getThemedAxisProps } from './design/chartTheme';

<CartesianGrid {...getThemedGridProps()} />
<XAxis {...getThemedAxisProps()} />
<Bar dataKey="simpanan" fill={chartColors.simpanan} />
```

**Commands:**
```bash
# Open App.tsx
code src/App.tsx

# Add import at top:
# import { chartColors, getThemedGridProps, getThemedAxisProps } from './design/chartTheme';

# Replace all CartesianGrid props
# Replace all XAxis/YAxis props
# Use chartColors.simpanan, chartColors.pinjaman
```

**Test:**
```bash
bun run dev
# Navigate to dashboard
# Toggle dark mode
# Verify charts change colors appropriately
```

### Step 1.3: Update Reports Charts

```bash
# Find all chart usage in Reports
grep -n "BarChart\|LineChart\|PieChart" src/pages/Reports.tsx

# Apply same pattern as App.tsx
# Import chartColors and helpers
# Replace hardcoded colors and props
```

### Step 1.4: Update SHU Charts

```bash
# SHU.tsx has pie chart with color array
# Before:
const COLORS = ['#0171E3', '#EB6E00', '#0B991F', '#6B1EFD', '#E30171'];

# After:
import { chartColors } from '../design/chartTheme';
const COLORS = chartColors.categorical;
```

**Checklist:**
- [ ] chartTheme.ts created
- [ ] App.tsx charts updated
- [ ] Reports.tsx charts updated
- [ ] SHU.tsx charts updated
- [ ] Dark mode toggle tested
- [ ] No hardcoded chart colors remaining

---

## 📝 Task 2: Consolidate Theme (1.5 hours)

### Problem Analysis

Current setup:
```
main.tsx
  ├── ThemeProvider (custom context)
  │   └── AppThemeProvider
  │       └── Theme (Astryx)
  │           └── AuthProvider
  │               └── App
```

This creates:
- Duplicate theme state management
- Potential inconsistencies
- Unnecessary complexity

### Solution: Simplify

**Goal:** Astryx Theme as single source of truth, minimal custom context.

### Step 2.1: Update ThemeContext

```bash
# Edit src/contexts/ThemeContext.tsx
code src/contexts/ThemeContext.tsx
```

```tsx
// Simplified ThemeContext
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}
```

**Key changes:**
- Removed `system` mode (just light/dark)
- Removed duplicate resolvedMode
- Removed complex media query handling
- Simplified to just store mode in localStorage

### Step 2.2: Update main.tsx

```tsx
// src/main.tsx
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import { Theme } from '@astryxdesign/core/theme';
import { koperasiTheme } from './design/theme';

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  
  return (
    <Theme theme={koperasiTheme} mode={mode}>
      {children}
    </Theme>
  );
}

// Root render
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AppThemeProvider>
            <AuthProvider>
              <LazyRoot />
            </AuthProvider>
          </AppThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
```

### Step 2.3: Update Shell.tsx

```tsx
// src/components/Shell.tsx
// Update theme toggle button
import { useThemeMode } from '../contexts/ThemeContext';

const { mode, setMode } = useThemeMode();
const isDark = mode === 'dark';

<IconButton
  icon={<Icon as={isDark ? SunIcon : MoonIcon} />}
  onClick={() => setMode(isDark ? 'light' : 'dark')}
  label="Toggle theme"
/>
```

**Checklist:**
- [ ] ThemeContext simplified
- [ ] main.tsx updated
- [ ] Shell.tsx theme toggle updated
- [ ] Dark/light toggle works
- [ ] No duplicate theme logic

---

## 📝 Task 3: Performance Optimization (2-3 hours)

### Step 3.1: Memoize Table Columns

**Pattern:**
```tsx
// BEFORE (re-creates columns array every render)
function Members() {
  const columns: TableColumn<MemberRow>[] = [
    { header: 'Nama', accessor: 'name' },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  
  return <Table columns={columns} data={members} />;
}

// AFTER (memoized)
import { useMemo } from 'react';

function Members() {
  const columns = useMemo<TableColumn<MemberRow>[]>(() => [
    { header: 'Nama', accessor: 'name', width: proportional(2) },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ], []); // Empty deps - columns definition is static
  
  return <Table columns={columns} data={members} />;
}
```

**Files to update:**
- `src/pages/Members.tsx`
- `src/pages/Loans.tsx`
- `src/pages/Savings.tsx`
- `src/pages/LoansTx.tsx`
- `src/pages/NPL.tsx`
- `src/pages/Cashflow.tsx`
- `src/pages/Expenses.tsx`

### Step 3.2: Memoize Calculations

```tsx
// BEFORE
function SHU() {
  const { data } = useApiQuery('/api/shu/2026');
  const chartData = data?.allocation.map(item => ({...}));
  
  return <PieChart data={chartData} />;
}

// AFTER
import { useMemo } from 'react';

function SHU() {
  const { data } = useApiQuery('/api/shu/2026');
  
  const chartData = useMemo(() => {
    if (!data?.allocation) return [];
    return data.allocation.map(item => ({
      name: item.category,
      value: item.amount,
    }));
  }, [data?.allocation]);
  
  return <PieChart data={chartData} />;
}
```

**Files with heavy calculations:**
- `src/pages/SHU.tsx` - SHU allocation calculations
- `src/pages/NPL.tsx` - NPL ratio calculations
- `src/pages/Reports.tsx` - Report data transformations

### Step 3.3: Lazy Load Dialogs

```tsx
// BEFORE
import { LoanDetailDialog } from '../components/LoanDetailDialog';

// AFTER
import { lazy, Suspense } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';

const LoanDetailDialog = lazy(() => import('../components/LoanDetailDialog'));

function LoansPage() {
  return (
    <>
      {selectedLoan && (
        <Suspense fallback={<Center><Spinner /></Center>}>
          <LoanDetailDialog loan={selectedLoan} />
        </Suspense>
      )}
    </>
  );
}
```

**Heavy dialogs to lazy load:**
- `LoanDetailDialog` (~900 LOC originally, now split)
- `ImportSavingsDialog` (309 LOC)
- `AddLoanDialog` (308 LOC)
- `AddMemberDialog` (391 LOC)

### Step 3.4: Optimize Icon Imports

```bash
# Find all icon imports
grep -rn "from '@heroicons" src/

# Check for bulk imports
grep -rn "import \*" src/ --include="*.tsx"
```

```tsx
// BEFORE
import * as Icons from '@heroicons/react/24/outline';
const { PencilIcon, TrashIcon } = Icons;

// AFTER
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
```

**Checklist:**
- [ ] All table columns memoized
- [ ] Heavy calculations memoized
- [ ] Large dialogs lazy loaded
- [ ] Icon imports optimized
- [ ] Build and check bundle size

---

## 📝 Task 4: Documentation (2-3 hours)

### Step 4.1: Component Library Reference

```bash
# Create component documentation
cat > docs/COMPONENTS.md << 'EOF'
# Component Library Reference

> Reusable components untuk Koperasi App

## Overview

Component library ini dibuat untuk:
- **Konsistensi**: Design language yang unified
- **Reusability**: DRY principle
- **Type Safety**: TypeScript interfaces
- **Maintainability**: Single source of truth

---

## Common Components

### FormField

Integrated form field dengan label, input, description, dan error display.

**Location:** `src/components/common/FormField.tsx`

**Import:**
\`\`\`tsx
import { FormField } from '../components/common';
\`\`\`

**Props:**
\`\`\`typescript
interface FormFieldProps extends Omit<TextInputProps, 'label'> {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
}
\`\`\`

**Usage:**
\`\`\`tsx
import { useForm, Controller } from 'react-hook-form';
import { FormField } from '../components/common';

function MyForm() {
  const { control, formState: { errors } } = useForm();
  
  return (
    <Controller
      name="name"
      control={control}
      rules={{ required: 'Nama wajib diisi' }}
      render={({ field }) => (
        <FormField
          label="Nama Lengkap"
          required
          error={errors.name?.message}
          description="Masukkan nama lengkap sesuai KTP"
          {...field}
        />
      )}
    />
  );
}
\`\`\`

**Best Practices:**
- ✅ Use with react-hook-form Controller
- ✅ Always provide error from validation
- ✅ Use description for helpful hints
- ❌ Don't nest FormField inside another VStack with gap
- ❌ Don't override error display with custom styling

---

### StatusBadge

Status badge dengan semantic color mapping.

**Location:** `src/components/common/StatusBadge.tsx`

**Import:**
\`\`\`tsx
import { StatusBadge } from '../components/common';
\`\`\`

**Props:**
\`\`\`typescript
type StatusType = 
  | 'Aktif' | 'Pasif' 
  | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Lunas' | 'Macet'
  | 'success' | 'error' | 'warning' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}
\`\`\`

**Usage:**
\`\`\`tsx
// Default: uses status as label
<StatusBadge status="Aktif" />

// Custom label (e.g., for translations)
<StatusBadge status="Lunas" label="Paid in Full" />

// In table columns
const columns = [
  {
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />
  }
];
\`\`\`

**Color Mapping:**
| Status | Color | Use Case |
|--------|-------|----------|
| Aktif | success (green) | Active member |
| Pasif | secondary (gray) | Inactive member |
| Menunggu | warning (yellow) | Pending loan |
| Disetujui | info (blue) | Approved loan |
| Ditolak | critical (red) | Rejected loan |
| Lunas | success (green) | Paid loan |
| Macet | critical (red) | Bad loan |

**Best Practices:**
- ✅ Use type-safe StatusType (IDE autocomplete)
- ✅ Let component handle color mapping
- ✅ Use in tables for consistent display
- ❌ Don't create custom badge colors
- ❌ Don't use Badge directly for status

---

### FormFieldError

Standalone error message component.

**Location:** `src/components/common/FormFieldError.tsx`

**Usage:**
\`\`\`tsx
import { FormFieldError } from '../components/common';

{error && <FormFieldError>{error}</FormFieldError>}
\`\`\`

---

### FormLabel

Standalone label component with required indicator.

**Location:** `src/components/common/FormLabel.tsx`

**Usage:**
\`\`\`tsx
import { FormLabel } from '../components/common';

<FormLabel required>Nama Lengkap</FormLabel>
<TextInput {...field} />
\`\`\`

---

## Component Architecture

### File Structure

\`\`\`
src/components/
├── common/              # Reusable generic components
│   ├── FormField.tsx
│   ├── StatusBadge.tsx
│   └── index.ts        # Barrel export
├── loan/               # Loan-specific components
│   ├── LoanInfoSection.tsx
│   ├── LoanScheduleTable.tsx
│   └── LoanPaymentForm.tsx
├── members/            # Member-specific components
│   ├── MembersList.tsx
│   ├── MembersFilters.tsx
│   └── MemberActions.tsx
└── settings/           # Settings-specific components
    ├── ProfileSettings.tsx
    ├── ParameterSettings.tsx
    └── TwoFactorSettings.tsx
\`\`\`

### Import Pattern

\`\`\`tsx
// ✅ Use barrel exports for common components
import { FormField, StatusBadge } from '../components/common';

// ✅ Direct import for feature-specific components
import { LoanInfoSection } from '../components/loan/LoanInfoSection';

// ❌ Avoid relative path complexity
import { FormField } from '../components/common/FormField';
\`\`\`

---

## Creating New Components

### Checklist

When creating a new reusable component:

- [ ] **TypeScript**: Define proper interface for props
- [ ] **JSDoc**: Add documentation comment
- [ ] **Semantic tokens**: Use design tokens, not hardcoded values
- [ ] **Astryx base**: Extend Astryx components when possible
- [ ] **Single responsibility**: One clear purpose
- [ ] **Test**: Verify in actual usage
- [ ] **Document**: Add to this file if reusable

### Template

\`\`\`tsx
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

export interface MyComponentProps {
  /** Prop description */
  title: string;
  /** Optional prop */
  subtitle?: string;
}

/**
 * Component description.
 * 
 * @example
 * <MyComponent title="Hello" subtitle="World" />
 */
export function MyComponent({ title, subtitle }: MyComponentProps) {
  return (
    <VStack gap={2}>
      <Text weight="bold">{title}</Text>
      {subtitle && <Text type="supporting">{subtitle}</Text>}
    </VStack>
  );
}
\`\`\`

---

## Related Documentation

- [Design Tokens](DESIGN_TOKENS.md) - Color, spacing, radius tokens
- [Common Patterns](PATTERNS.md) - Best practices
- [Astryx Docs](https://astryx.atmeta.com/docs/core) - Base components
EOF
```

### Step 4.2: Design Tokens Documentation

```bash
cat > docs/DESIGN_TOKENS.md << 'EOF'
# Design Tokens Reference

> Centralized design tokens untuk consistent styling

## Overview

Design tokens adalah named values untuk colors, spacing, typography, etc. yang digunakan di seluruh aplikasi.

**Benefits:**
- ✅ Single source of truth
- ✅ Easy to update (change once, affects all)
- ✅ Type-safe with TypeScript
- ✅ Dark mode support built-in

---

## Usage

\`\`\`tsx
import { semanticColors, spacing, radius } from '../design/tokens';

// In component
<div style={{ 
  color: semanticColors.success,
  padding: spacing.md,
  borderRadius: radius.lg 
}}>
  Success message
</div>
\`\`\`

---

## Semantic Colors

### Status Colors

| Token | CSS Variable | Light | Dark | Usage |
|-------|--------------|-------|------|-------|
| \`semanticColors.success\` | \`--color-success-500\` | #10b981 | #34d399 | Success states, Aktif, Lunas |
| \`semanticColors.error\` | \`--color-critical-500\` | #ef4444 | #f87171 | Error states, Ditolak, Macet |
| \`semanticColors.warning\` | \`--color-warning-500\` | #f59e0b | #fbbf24 | Warning, Menunggu |
| \`semanticColors.info\` | \`--color-primary-500\` | #0171E3 | #3b82f6 | Info, Disetujui |

### Text Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| \`semanticColors.textPrimary\` | \`--color-text-primary\` | Main text |
| \`semanticColors.textSecondary\` | \`--color-text-secondary\` | Supporting text |
| \`semanticColors.textCritical\` | \`--color-text-critical\` | Error text |
| \`semanticColors.textSuccess\` | \`--color-text-success\` | Success text |

### Background Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| \`semanticColors.bgPrimary\` | \`--color-background-primary\` | Main background |
| \`semanticColors.bgSecondary\` | \`--color-background-secondary\` | Cards, sections |
| \`semanticColors.bgSubtle\` | \`--color-background-subtle\` | Subtle highlights |

### Border Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| \`semanticColors.borderPrimary\` | \`--color-border-primary\` | Primary borders |
| \`semanticColors.border\` | \`--color-border\` | Default borders |

### Data Visualization

For charts (Recharts integration):

| Token | Value | Usage |
|-------|-------|-------|
| \`semanticColors.dataBlue\` | #0171E3 | Simpanan, primary series |
| \`semanticColors.dataOrange\` | #EB6E00 | Pinjaman, secondary series |
| \`semanticColors.dataGreen\` | #0B991F | Tertiary series |
| \`semanticColors.dataPurple\` | #6B1EFD | Quaternary series |
| \`semanticColors.dataPink\` | #E30171 | Quinary series |

---

## Spacing

| Token | CSS Variable | Value | Usage |
|-------|--------------|-------|-------|
| \`spacing.xs\` | \`--spacing-2\` | 8px | Tight spacing |
| \`spacing.sm\` | \`--spacing-3\` | 12px | Small gaps |
| \`spacing.md\` | \`--spacing-4\` | 16px | Default spacing |
| \`spacing.lg\` | \`--spacing-6\` | 24px | Large gaps |
| \`spacing.xl\` | \`--spacing-8\` | 32px | Extra large gaps |

**Note:** Astryx components accept numeric gap values (1-10) that map to spacing scale.

---

## Border Radius

| Token | CSS Variable | Value | Usage |
|-------|--------------|-------|-------|
| \`radius.sm\` | \`--radius-sm\` | 4px | Buttons, badges |
| \`radius.md\` | \`--radius-md\` | 6px | Cards, inputs |
| \`radius.lg\` | \`--radius-lg\` | 8px | Dialogs, modals |

---

## Helper Functions

### getStatusColor

\`\`\`typescript
function getStatusColor(status: 'success' | 'error' | 'warning' | 'info'): string
\`\`\`

**Usage:**
\`\`\`tsx
const color = getStatusColor('success'); // Returns semanticColors.success
<Text style={{ color }}>Success!</Text>
\`\`\`

### getCashflowColor

\`\`\`typescript
function getCashflowColor(type: 'inflow' | 'outflow'): string
\`\`\`

**Usage:**
\`\`\`tsx
const color = getCashflowColor(transaction.type);
// inflow → success (green)
// outflow → error (red)
<Text style={{ color }}>{formatRp(amount)}</Text>
\`\`\`

---

## Chart Theming

See [chartTheme.ts](../src/design/chartTheme.ts) for Recharts integration.

\`\`\`tsx
import { chartColors, getThemedGridProps, getThemedAxisProps } from '../design/chartTheme';

<BarChart data={data}>
  <CartesianGrid {...getThemedGridProps()} />
  <XAxis {...getThemedAxisProps()} />
  <Bar dataKey="value" fill={chartColors.dataBlue} />
</BarChart>
\`\`\`

---

## Best Practices

### ✅ DO

\`\`\`tsx
// Use semantic tokens
import { semanticColors } from '../design/tokens';
<Text style={{ color: semanticColors.success }}>Berhasil</Text>

// Use helper functions for dynamic colors
const color = getCashflowColor(type);

// Use Astryx component props when available
<Text color="success">Berhasil</Text>
\`\`\`

### ❌ DON'T

\`\`\`tsx
// Don't hardcode hex colors
<Text style={{ color: '#10b981' }}>Berhasil</Text>

// Don't use raw CSS variables with fallbacks
<Text style={{ color: 'var(--color-success, #10b981)' }}>Berhasil</Text>

// Don't create new color values
<Text style={{ color: '#custom123' }}>Custom</Text>
\`\`\`

---

## Adding New Tokens

If you need a new token:

1. **Check if existing token works** - Don't create duplicates
2. **Add to tokens.ts** - With clear naming
3. **Document here** - Update this file
4. **Use CSS variable** - Map to Astryx variable when possible

\`\`\`typescript
// src/design/tokens.ts
export const semanticColors = {
  // ... existing tokens
  
  // New token
  myNewColor: 'var(--color-new, #fallback)',
} as const;
\`\`\`

---

## Related Documentation

- [Component Library](COMPONENTS.md)
- [Common Patterns](PATTERNS.md)
- [Astryx Theming](https://astryx.atmeta.com/docs/theming)
EOF
```

### Step 4.3: Common Patterns Documentation

```bash
cat > docs/PATTERNS.md << 'EOF'
# Common Patterns & Best Practices

> Established patterns untuk Koperasi App

---

## Component Architecture

### Separation of Concerns

**Page Components** (Smart):
- Data fetching (useApiQuery, useApiAction)
- Application state management
- Business logic
- Orchestrate child components
- Handle routing/navigation

**UI Components** (Dumb):
- Receive data via props
- Emit events via callbacks
- No direct API calls
- No application state
- Reusable and testable

### Example

\`\`\`tsx
// ✅ GOOD: Page handles data, component handles UI
function MembersPage() {
  const { data, isLoading, refetch } = useApiQuery('/api/members');
  const apiAction = useApiAction();
  
  const handleDelete = (id: number) => {
    apiAction.execute(
      () => api.delete(\`/api/members/\${id}\`),
      { successMsg: 'Anggota dihapus', onSuccess: refetch }
    );
  };
  
  return (
    <MembersList 
      members={data?.items || []} 
      isLoading={isLoading}
      onDelete={handleDelete}
    />
  );
}

// ❌ BAD: Component doing data fetching
function MembersList() {
  const { data } = useApiQuery('/api/members'); // ❌ Wrong layer
  return <Table data={data} />;
}
\`\`\`

---

## Form Patterns

### Using FormField with react-hook-form

\`\`\`tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '../components/common';

const schema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid').optional(),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  const onSubmit = (data: FormData) => {
    console.log(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <VStack gap={4}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <FormField
              label="Nama Lengkap"
              required
              error={errors.name?.message}
              {...field}
            />
          )}
        />
        
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <FormField
              label="Email"
              type="email"
              description="Opsional"
              error={errors.email?.message}
              {...field}
            />
          )}
        />
        
        <Button type="submit">Simpan</Button>
      </VStack>
    </form>
  );
}
\`\`\`

---

## Chart Patterns

### Theming Recharts

\`\`\`tsx
import { chartColors, getThemedGridProps, getThemedAxisProps, getThemedTooltipProps } from '../design/chartTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MyChart({ data }: { data: Array<{month: string; value: number}> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid {...getThemedGridProps()} />
        <XAxis dataKey="month" {...getThemedAxisProps()} />
        <YAxis {...getThemedAxisProps()} />
        <Tooltip {...getThemedTooltipProps()} />
        <Bar dataKey="value" fill={chartColors.dataBlue} />
      </BarChart>
    </ResponsiveContainer>
  );
}
\`\`\`

---

## Performance Patterns

### Memoization

\`\`\`tsx
import { useMemo } from 'react';

function MyComponent({ data }: { data: Item[] }) {
  // Expensive calculation - only recalculate when data changes
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.value - b.value);
  }, [data]);
  
  // Static definition - never recalculate
  const columns = useMemo<TableColumn<Item>[]>(() => [
    { header: 'Name', accessor: 'name' },
    { header: 'Value', accessor: 'value' },
  ], []);
  
  return <Table columns={columns} data={sortedData} />;
}
\`\`\`

### Lazy Loading

\`\`\`tsx
import { lazy, Suspense } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Center } from '@astryxdesign/core/Center';

// Heavy component loaded on-demand
const HeavyDialog = lazy(() => import('../components/HeavyDialog'));

function Page() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
      
      {isOpen && (
        <Suspense fallback={<Center><Spinner /></Center>}>
          <HeavyDialog onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
\`\`\`

---

## API Patterns

### Using useApiQuery

\`\`\`tsx
import { useApiQuery } from '../hooks/useApiQuery';

function MyComponent() {
  const { data, isLoading, error, refetch } = useApiQuery<MyData>('/api/endpoint');
  
  if (isLoading) return <Spinner />;
  if (error) return <Text color="critical">{error}</Text>;
  
  return <div>{data?.value}</div>;
}
\`\`\`

### Using useApiAction

\`\`\`tsx
import { useApiAction } from '../hooks/useApiAction';
import { api } from '../services/api';

function MyComponent() {
  const apiAction = useApiAction();
  
  const handleSave = (data: FormData) => {
    apiAction.execute(
      () => api.post('/api/endpoint', data),
      {
        successMsg: 'Data berhasil disimpan',
        errorMsg: 'Gagal menyimpan data',
        onSuccess: () => {
          console.log('Success callback');
          refetchData();
        },
      }
    );
  };
  
  return (
    <Button onClick={handleSave} disabled={apiAction.isLoading}>
      {apiAction.isLoading ? 'Menyimpan...' : 'Simpan'}
    </Button>
  );
}
\`\`\`

---

## Table Patterns

### Defining Columns

\`\`\`tsx
import { useMemo } from 'react';
import { Table, proportional, pixel, type TableColumn } from '@astryxdesign/core/Table';
import { StatusBadge } from '../components/common';
import { formatRp, formatDate } from '../utils/format';

function MyTable({ data }: { data: MemberRow[] }) {
  const columns = useMemo<TableColumn<MemberRow>[]>(() => [
    {
      header: 'Nama',
      accessor: 'name',
      width: proportional(2), // Takes 2x space
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
      width: pixel(100), // Fixed width
    },
    {
      header: 'Saldo',
      render: (row) => <Text>{formatRp(row.balance)}</Text>,
      align: 'right',
    },
    {
      header: 'Tanggal Gabung',
      render: (row) => <Text type="supporting">{formatDate(row.joinedAt)}</Text>,
    },
  ], []);
  
  return <Table columns={columns} data={data} />;
}
\`\`\`

---

## Error Handling

### User-Friendly Error Messages

\`\`\`tsx
// API errors are already handled in useApiQuery/useApiAction
// They show toast notifications automatically

// For custom error handling:
import { useToast } from '@astryxdesign/core/Toast';

function MyComponent() {
  const toast = useToast();
  
  const handleError = (error: Error) => {
    // Map technical errors to user-friendly messages
    const message = error.message.includes('Network')
      ? 'Koneksi internet terputus'
      : 'Terjadi kesalahan. Silakan coba lagi.';
    
    toast.show({ message, type: 'error' });
  };
  
  return <div>...</div>;
}
\`\`\`

---

## Testing Patterns

### Manual Testing Checklist

After making changes:

- [ ] Page loads without console errors
- [ ] Forms validate correctly
- [ ] API calls succeed
- [ ] Loading states display
- [ ] Error handling works
- [ ] Toast notifications appear
- [ ] Dark mode works
- [ ] Responsive on mobile

---

## Code Style

### TypeScript

\`\`\`tsx
// ✅ Define explicit interfaces
interface MyComponentProps {
  title: string;
  count: number;
  onSave: (data: FormData) => void;
}

// ✅ Use type for union types
type Status = 'active' | 'inactive';

// ✅ Infer return types when obvious
function MyComponent({ title }: MyComponentProps) { // implicit ReactElement
  return <div>{title}</div>;
}
\`\`\`

### Imports

\`\`\`tsx
// Group imports logically
// 1. External libraries
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';

// 2. Astryx components
import { VStack } from '@astryxdesign/core/Stack';
import { Button } from '@astryxdesign/core/Button';

// 3. Internal components
import { FormField, StatusBadge } from '../components/common';

// 4. Hooks, utils, types
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp } from '../utils/format';
import type { MemberRow } from '../../shared/types';
\`\`\`

---

## Related Documentation

- [Component Library](COMPONENTS.md)
- [Design Tokens](DESIGN_TOKENS.md)
- [Astryx Best Practices](https://astryx.atmeta.com/docs/best-practices)
EOF
```

**Checklist:**
- [ ] COMPONENTS.md created
- [ ] DESIGN_TOKENS.md created
- [ ] PATTERNS.md created
- [ ] All examples are accurate
- [ ] Documentation is clear

---

## 📝 Task 5: Final Cleanup (1 hour)

### Step 5.1: Find Remaining Inline Styles

```bash
# Count inline styles
grep -r "style={{" src/ --include="*.tsx" | wc -l

# List all instances
grep -rn "style={{" src/ --include="*.tsx"

# Target: < 10 instances
```

**Review each instance:**
- Is it justified? (dynamic, third-party workaround)
- Can it use Astryx props instead?
- Can it use tokens?

### Step 5.2: Remove Unused Imports

```bash
# Run lint
bun run lint

# Check TypeScript unused
bun run typecheck

# Fix automatically where possible
# Manual review for the rest
```

### Step 5.3: Update README

```bash
# Add design system section to README
code README.md
```

Add after "Fitur utama" section:

```markdown
## Design System

Aplikasi ini menggunakan **Astryx Design System** by Meta dengan custom theme dan design tokens.

### Arsitektur

- **Design Tokens:** `src/design/tokens.ts` - Semantic colors, spacing, radius
- **Custom Theme:** `src/design/theme.ts` - Koperasi theme configuration
- **Chart Theme:** `src/design/chartTheme.ts` - Recharts integration
- **Common Components:** `src/components/common/` - Reusable UI components

### Dokumentasi

- [Component Library](docs/COMPONENTS.md) - Reusable components reference
- [Design Tokens](docs/DESIGN_TOKENS.md) - Token system guide
- [Common Patterns](docs/PATTERNS.md) - Best practices & patterns

### Development Guidelines

1. **Use design tokens** - No hardcoded colors/spacing
2. **Extend Astryx components** - Don't reinvent the wheel
3. **Follow patterns** - Check `docs/PATTERNS.md` for established patterns
4. **Document reusable components** - Update `docs/COMPONENTS.md`

### Adding New Features

\`\`\`tsx
// 1. Import semantic tokens
import { semanticColors } from './design/tokens';

// 2. Use Astryx components as base
import { Card, VStack, Text } from '@astryxdesign/core';

// 3. Use reusable components
import { FormField, StatusBadge } from './components/common';

// 4. Follow separation of concerns (smart page, dumb components)
\`\`\`
```

**Checklist:**
- [ ] < 10 inline styles (only justified)
- [ ] No unused imports
- [ ] README updated
- [ ] All files formatted

---

## 🧪 Testing Checklist

### Functional Testing
- [ ] All pages load
- [ ] Dark/light toggle works
- [ ] Charts display correctly
- [ ] Forms work
- [ ] Dialogs open/close
- [ ] Tables function
- [ ] API calls succeed

### Performance Testing
```bash
# Build
bun run build

# Check bundle size
ls -lh dist/assets/*.js

# Compare with baseline (before Week 3)
# Expected: 10-15% reduction
```

- [ ] Build succeeds
- [ ] Bundle size reduced
- [ ] No performance regressions
- [ ] Lazy loading works

### Documentation Testing
- [ ] Copy-paste examples work
- [ ] Prop interfaces match code
- [ ] Links are valid

---

## ✅ Completion Checklist

- [ ] Task 1: Chart integration complete
- [ ] Task 2: Theme consolidated
- [ ] Task 3: Performance optimized
- [ ] Task 4: Documentation created
- [ ] Task 5: Final cleanup done
- [ ] All tests passed
- [ ] PR submitted

---

## 🎯 Success Metrics

- Bundle size reduced 10-15%
- < 10 inline styles remaining
- 0 hardcoded colors
- 100% components documented
- Dark mode flawless
- Team can understand and extend

Good luck with the final polish! 🚀
