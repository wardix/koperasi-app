# [Design System] Integration, optimization, and documentation

## 🎨 Deskripsi

Week 1 & 2 sudah membersihkan design tokens dan refactor komponen besar. Week 3 adalah **final polish**: integrasikan chart colors dengan theme, consolidate theme management, optimize performance, dan dokumentasi untuk long-term maintainability.

**Masalah:**
- Chart colors (Recharts) belum terintegrasi dengan design tokens
- Ada duplikasi theme management (Astryx Theme + custom ThemeContext)
- Tidak ada dokumentasi component patterns untuk tim
- Belum ada performance optimization (memoization, lazy loading)
- Inline styles masih tersisa di beberapa tempat

## 🎯 Goal Week 3

Finalisasi design system dengan integrasi penuh, optimisasi performa, dan dokumentasi komprehensif untuk maintainability jangka panjang.

---

## ✅ Task List

### Task 1: Integrate Chart Colors with Design Tokens

**Problem:** Recharts di `App.tsx`, `Reports.tsx`, `SHU.tsx` menggunakan hardcoded colors atau CSS variables yang tidak konsisten dengan design token system.

**Files to update:**
- `src/App.tsx` (Dashboard charts)
- `src/pages/Reports.tsx` (Report charts)
- `src/pages/SHU.tsx` (SHU pie chart)

**Implementation:**

#### Step 1.1: Create Chart Theme Helper
```typescript
// src/design/chartTheme.ts
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
 * Get color by index for multi-series charts
 */
export function getCategoricalColor(index: number): string {
  return chartColors.categorical[index % chartColors.categorical.length];
}

/**
 * Recharts CartesianGrid props with theme support
 */
export function getThemedGridProps() {
  return {
    stroke: chartColors.grid,
    strokeDasharray: '3 3',
  };
}

/**
 * Recharts XAxis/YAxis props with theme support
 */
export function getThemedAxisProps() {
  return {
    tick: { fill: chartColors.axis },
    tickLine: { stroke: chartColors.axis },
  };
}

/**
 * Recharts Tooltip props with theme support
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
```

#### Step 1.2: Update Dashboard Charts (App.tsx)
```tsx
// Before
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const chartColors = {
  simpanan: 'var(--color-data-categorical-blue, #0171E3)',
  pinjaman: 'var(--color-data-categorical-orange, #EB6E00)',
};

<CartesianGrid stroke="var(--color-border, rgba(5, 54, 89, 0.1))" />
<XAxis tick={{ fill: 'var(--color-text-secondary, #4E606F)' }} />

// After
import { chartColors, getThemedGridProps, getThemedAxisProps } from './design/chartTheme';

<CartesianGrid {...getThemedGridProps()} />
<XAxis {...getThemedAxisProps()} />
<Bar dataKey="simpanan" fill={chartColors.simpanan} />
<Bar dataKey="pinjaman" fill={chartColors.pinjaman} />
```

**Acceptance Criteria:**
- [ ] `src/design/chartTheme.ts` created with helper functions
- [ ] All charts in App.tsx use chartTheme helpers
- [ ] All charts in Reports.tsx use chartTheme helpers
- [ ] All charts in SHU.tsx use chartTheme helpers
- [ ] Charts respond correctly to dark mode toggle
- [ ] No hardcoded chart colors remaining

---

### Task 2: Consolidate Theme Management

**Problem:** Ada dua sistem theme yang overlap:
1. Astryx `<Theme>` component dengan `neutralTheme`
2. Custom `ThemeContext` untuk dark/light mode

Ini menyebabkan duplikasi dan potential inconsistency.

**Solution:** Gunakan Astryx theme system sebagai single source of truth.

**Files to update:**
- `src/main.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/components/Shell.tsx`

**Implementation:**

#### Step 2.1: Enhance Astryx Theme Integration
```tsx
// src/main.tsx (simplified)
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';
import { koperasiTheme } from './design/theme';

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const className = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(className);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <Theme theme={koperasiTheme} mode={mode}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}
```

#### Step 2.2: Update Theme Context
```tsx
// src/contexts/ThemeContext.tsx (simplified)
export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}
```

**Key changes:**
- Remove `system` mode (simplify to light/dark only)
- Remove duplicate theme application logic
- Rely on Astryx Theme component for CSS variable generation
- Keep ThemeContext minimal (just mode state)

**Acceptance Criteria:**
- [ ] Single theme system (Astryx as source of truth)
- [ ] ThemeContext simplified (no duplicate logic)
- [ ] Dark/light toggle works correctly
- [ ] All components respect theme mode
- [ ] CSS variables applied consistently

---
### Task 3: Performance Optimization

**Problem:** Komponen besar sering re-render unnecessarily, dan beberapa komponen berat bisa di-lazy load.

**Optimization targets:**
1. Memoize expensive calculations (SHU calculations, NPL ratio)
2. Memoize table columns definitions
3. Lazy load heavy dialogs
4. Optimize image/icon imports

**Implementation:**

#### Step 3.1: Memoize Heavy Calculations
```tsx
// src/pages/SHU.tsx
import { useMemo } from 'react';

export default function SHU() {
  const { data: shuData } = useApiQuery<SHUData>(`/api/shu/${year}`);
  
  // Before: recalculates on every render
  const chartData = shuData?.allocation.map(...);
  
  // After: only recalculates when shuData changes
  const chartData = useMemo(() => {
    if (!shuData) return [];
    return shuData.allocation.map(item => ({
      name: item.category,
      value: item.amount,
    }));
  }, [shuData]);
  
  return <PieChart data={chartData} />;
}
```

#### Step 3.2: Memoize Table Columns
```tsx
// src/pages/Members.tsx
import { useMemo } from 'react';
import type { TableColumn } from '@astryxdesign/core/Table';

export default function Members() {
  // Before: columns redefined on every render (expensive)
  const columns: TableColumn<MemberRow>[] = [
    { header: 'Nama', ... },
    { header: 'Status', ... },
  ];
  
  // After: columns memoized
  const columns = useMemo<TableColumn<MemberRow>[]>(() => [
    { header: 'Nama', accessor: 'name', width: proportional(2) },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    // ...
  ], []); // Empty deps because columns don't depend on props/state
  
  return <Table columns={columns} data={members} />;
}
```

#### Step 3.3: Lazy Load Heavy Dialogs
```tsx
// src/pages/Loans.tsx
import { lazy, Suspense } from 'react';

// Before: all dialog components loaded upfront
import { LoanDetailDialog } from '../components/LoanDetailDialog';

// After: lazy load (only when dialog opens)
const LoanDetailDialog = lazy(() => import('../components/LoanDetailDialog'));

function LoansPage() {
  return (
    <>
      {selectedLoan && (
        <Suspense fallback={<Spinner />}>
          <LoanDetailDialog loan={selectedLoan} />
        </Suspense>
      )}
    </>
  );
}
```

#### Step 3.4: Optimize Icon Imports
```tsx
// Before: importing entire icon set
import * as Icons from '@heroicons/react/24/outline';

// After: named imports (tree-shakeable)
import { 
  PencilIcon, 
  TrashIcon, 
  BanknotesIcon 
} from '@heroicons/react/24/outline';
```

**Files to optimize:**
- `src/pages/Members.tsx`
- `src/pages/Loans.tsx`
- `src/pages/SHU.tsx`
- `src/pages/NPL.tsx`
- `src/pages/Reports.tsx`

**Acceptance Criteria:**
- [ ] Heavy calculations memoized with `useMemo`
- [ ] Table columns memoized
- [ ] Large dialogs lazy loaded
- [ ] Icon imports optimized (named imports only)
- [ ] Build bundle size reduced (check with `bun run build`)
- [ ] No performance regressions (test manually)

---

### Task 4: Create Component Documentation

**Problem:** Tidak ada dokumentasi untuk reusable components, making it hard untuk tim baru atau AI assistants untuk understand usage patterns.

**Solution:** Create comprehensive component documentation dengan examples.

**Files to create:**
- `docs/COMPONENTS.md` - Component library reference
- `docs/DESIGN_TOKENS.md` - Design token reference
- `docs/PATTERNS.md` - Common patterns & best practices

**Implementation:**

#### Step 4.1: Component Library Reference
```markdown
<!-- docs/COMPONENTS.md -->
# Component Library Reference

> Dokumentasi untuk reusable components di Koperasi App

## Common Components

### FormField

Integrated form field dengan label, input, error display.

**Import:**
\`\`\`tsx
import { FormField } from '../components/common';
\`\`\`

**Props:**
\`\`\`typescript
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  // ... extends TextInputProps
}
\`\`\`

**Usage:**
\`\`\`tsx
<FormField
  label="Nama Lengkap"
  required
  error={errors.name?.message}
  value={value}
  onChange={onChange}
/>
\`\`\`

**Best Practices:**
- Use with react-hook-form Controller
- Always provide error message from validation
- Use description for helpful hints

---

### StatusBadge

Consistent status badge dengan semantic colors.

**Import:**
\`\`\`tsx
import { StatusBadge } from '../components/common';
\`\`\`

**Props:**
\`\`\`typescript
type StatusType = 
  | 'Aktif' | 'Pasif'
  | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Lunas' | 'Macet';

interface StatusBadgeProps {
  status: StatusType;
  label?: string; // Override display text
}
\`\`\`

**Usage:**
\`\`\`tsx
<StatusBadge status="Aktif" />
<StatusBadge status="Lunas" label="Paid in Full" />
\`\`\`

**Best Practices:**
- Use type-safe StatusType (autocomplete in IDE)
- Let component handle color mapping
- Override label only for i18n or custom text

---

<!-- Add more components... -->
\`\`\`

#### Step 4.2: Design Token Reference
```markdown
<!-- docs/DESIGN_TOKENS.md -->
# Design Token Reference

> Centralized design tokens for consistent styling

## Usage

\`\`\`tsx
import { semanticColors, spacing, radius } from '../design/tokens';
\`\`\`

## Semantic Colors

### Status Colors
| Token | CSS Variable | Light Mode | Dark Mode | Usage |
|-------|--------------|------------|-----------|-------|
| `semanticColors.success` | `--color-success-500` | #10b981 | #34d399 | Success states, active status |
| `semanticColors.error` | `--color-critical-500` | #ef4444 | #f87171 | Error states, rejected status |
| `semanticColors.warning` | `--color-warning-500` | #f59e0b | #fbbf24 | Warning states, pending |
| `semanticColors.info` | `--color-primary-500` | #0171E3 | #3b82f6 | Info states, approved |

### Data Visualization
| Token | Value | Usage |
|-------|-------|-------|
| `semanticColors.dataBlue` | #0171E3 | Simpanan, primary data series |
| `semanticColors.dataOrange` | #EB6E00 | Pinjaman, secondary series |
| `semanticColors.dataGreen` | #0B991F | Tertiary series |
| `semanticColors.dataPurple` | #6B1EFD | Quaternary series |
| `semanticColors.dataPink` | #E30171 | Quinary series |

## Helper Functions

### getStatusColor
\`\`\`typescript
function getStatusColor(status: 'success' | 'error' | 'warning' | 'info'): string
\`\`\`

### getCashflowColor
\`\`\`typescript
function getCashflowColor(type: 'inflow' | 'outflow'): string
// Returns: success for inflow, error for outflow
\`\`\`

## Best Practices

✅ **DO:**
- Use semantic tokens (not raw CSS variables)
- Use helper functions for dynamic colors
- Reference tokens in component styles

❌ **DON'T:**
- Hardcode hex colors
- Use raw CSS variables with fallbacks
- Create new color values outside token system
\`\`\`

#### Step 4.3: Common Patterns
```markdown
<!-- docs/PATTERNS.md -->
# Common Patterns & Best Practices

## Component Architecture

### Separation of Concerns

**Page Components:**
- Handle data fetching (useApiQuery)
- Manage application state
- Orchestrate child components
- Handle routing/navigation

**UI Components:**
- Receive data via props
- Emit events via callbacks
- No direct API calls
- Reusable and testable

**Example:**
\`\`\`tsx
// ✅ Good: Page handles data, component handles UI
function MembersPage() {
  const { data, refetch } = useApiQuery('/api/members');
  const handleDelete = (id) => { /* API call */ };
  
  return <MembersList members={data} onDelete={handleDelete} />;
}

// ❌ Bad: Component doing data fetching
function MembersList() {
  const { data } = useApiQuery('/api/members'); // ❌
  return <Table data={data} />;
}
\`\`\`

## Form Patterns

### Using FormField with react-hook-form

\`\`\`tsx
import { useForm, Controller } from 'react-hook-form';
import { FormField } from '../components/common';

function MyForm() {
  const { control, handleSubmit, formState: { errors } } = useForm();
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="name"
        control={control}
        rules={{ required: 'Nama wajib diisi' }}
        render={({ field }) => (
          <FormField
            label="Nama Lengkap"
            required
            error={errors.name?.message}
            {...field}
          />
        )}
      />
    </form>
  );
}
\`\`\`

## Chart Patterns

### Theming Recharts

\`\`\`tsx
import { chartColors, getThemedGridProps, getThemedAxisProps } from '../design/chartTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

function MyChart({ data }) {
  return (
    <BarChart data={data}>
      <CartesianGrid {...getThemedGridProps()} />
      <XAxis {...getThemedAxisProps()} />
      <YAxis {...getThemedAxisProps()} />
      <Bar dataKey="value" fill={chartColors.dataBlue} />
    </BarChart>
  );
}
\`\`\`

## Performance Patterns

### Memoization

\`\`\`tsx
import { useMemo } from 'react';

// Expensive calculation
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);

// Table columns (static)
const columns = useMemo(() => [
  { header: 'Name', accessor: 'name' },
  { header: 'Value', accessor: 'value' },
], []);
\`\`\`

### Lazy Loading

\`\`\`tsx
import { lazy, Suspense } from 'react';

const HeavyDialog = lazy(() => import('../components/HeavyDialog'));

function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      {isOpen && <HeavyDialog />}
    </Suspense>
  );
}
\`\`\`
\`\`\`

**Acceptance Criteria:**
- [ ] `docs/COMPONENTS.md` created with all reusable components
- [ ] `docs/DESIGN_TOKENS.md` created with token reference
- [ ] `docs/PATTERNS.md` created with common patterns
- [ ] Examples are accurate and tested
- [ ] Documentation is clear and helpful

---

### Task 5: Final Cleanup & Polish

**Problem:** Masih ada inline styles tersisa, unused imports, dan minor inconsistencies.

**Cleanup checklist:**

#### Step 5.1: Remove Remaining Inline Styles
```bash
# Find remaining inline styles
grep -r "style={{" src/ --include="*.tsx" | wc -l

# Target: < 10 instances (only justified cases like dynamic positioning)
```

**Justified inline styles:**
- Dynamic calculations (positioning, sizing based on data)
- Third-party component customization (Recharts)
- Temporary workarounds with TODO comment

**Unjustified inline styles:**
- Static colors, spacing, borders → use Astryx props or tokens
- Repetitive patterns → extract to component
- Layout positioning → use Layout components

#### Step 5.2: Clean Up Unused Imports
```bash
# Use oxlint to find unused imports
bun run lint

# Or manually with TypeScript
bun run typecheck --noUnusedLocals --noUnusedParameters
```

#### Step 5.3: Consolidate CSS Files
Review `src/index.css` and `src/App.css`:
- Remove unused CSS classes
- Document remaining custom styles
- Ensure no conflicts with Astryx classes

#### Step 5.4: Update README
Add design system section to README.md:

```markdown
## Design System

Aplikasi ini menggunakan **Astryx Design System** by Meta dengan custom theme.

### Key Files
- `src/design/tokens.ts` - Semantic color tokens
- `src/design/theme.ts` - Koperasi custom theme
- `src/design/chartTheme.ts` - Chart theming utilities

### Documentation
- [Component Library](docs/COMPONENTS.md)
- [Design Tokens](docs/DESIGN_TOKENS.md)
- [Common Patterns](docs/PATTERNS.md)

### Adding New Components
1. Use Astryx components as base
2. Reference semantic tokens from `design/tokens.ts`
3. Follow patterns in `docs/PATTERNS.md`
4. Document in `docs/COMPONENTS.md` if reusable
```

**Acceptance Criteria:**
- [ ] < 10 inline styles remaining (only justified cases)
- [ ] No unused imports (oxlint clean)
- [ ] CSS files reviewed and documented
- [ ] README updated with design system section
- [ ] All files formatted consistently

---

## 📸 Testing Checklist

### Functional Testing
- [ ] All pages load without errors
- [ ] Dark/light mode toggle works everywhere
- [ ] Charts display correctly in both modes
- [ ] Forms validate and submit
- [ ] Dialogs open/close properly
- [ ] Tables sort/filter/paginate
- [ ] API calls succeed

### Visual Testing
- [ ] No visual regressions (compare screenshots)
- [ ] Charts are readable in both modes
- [ ] Colors are consistent across app
- [ ] Spacing and layout preserved
- [ ] Icons render correctly
- [ ] Responsive behavior works

### Performance Testing
```bash
# Build and check bundle size
bun run build

# Check bundle size report
ls -lh dist/assets/*.js

# Compare with baseline (before optimization)
# Target: 10-15% reduction in bundle size
```

- [ ] Build succeeds without warnings
- [ ] Bundle size reduced vs baseline
- [ ] Page load feels faster (manual test)
- [ ] No unnecessary re-renders (React DevTools)
- [ ] Lazy loading works (check Network tab)

### Documentation Testing
- [ ] All code examples in docs work (copy-paste test)
- [ ] Component props match actual implementation
- [ ] Links in docs are valid
- [ ] Examples cover common use cases

---

## 📚 Resources

### Astryx
- [Theming Guide](https://astryx.atmeta.com/docs/theming)
- [Performance Best Practices](https://astryx.atmeta.com/docs/performance)
- [Dark Mode Support](https://astryx.atmeta.com/docs/dark-mode)

### React
- [useMemo Hook](https://react.dev/reference/react/useMemo)
- [Lazy Loading](https://react.dev/reference/react/lazy)
- [Code Splitting](https://react.dev/learn/code-splitting)

### Recharts
- [Customization](https://recharts.org/en-US/guide/customize)
- [Theming](https://recharts.org/en-US/examples/CustomizedLabelLineChart)

---

## 🔍 Definition of Done

### Code Quality
- [ ] All 5 tasks completed
- [ ] TypeScript compiles with no errors
- [ ] Oxlint passes with no warnings
- [ ] Build succeeds
- [ ] No console errors in development

### Functionality
- [ ] All features work identically to before
- [ ] No regressions introduced
- [ ] Dark/light mode works perfectly
- [ ] Charts themed correctly
- [ ] Performance improved (bundle size, load time)

### Documentation
- [ ] Component library documented
- [ ] Design tokens documented
- [ ] Common patterns documented
- [ ] README updated
- [ ] Code comments clear

### Testing
- [ ] Manual testing checklist complete
- [ ] Visual regression check passed
- [ ] Performance metrics improved
- [ ] No broken links in docs

---

## 💡 Notes

- **Prioritas:** Medium-High (polish & long-term maintainability)
- **Estimated effort:** 8-10 hours
- **Breaking changes:** None (all internal improvements)
- **Dependencies:** Week 1 & 2 must be completed
- **Optional but recommended:** Performance profiling with React DevTools Profiler

**Implementation strategy:**
- Tasks 1-2 can be done in parallel (charts vs theme)
- Task 3 (performance) after Tasks 1-2
- Task 4 (docs) can be done anytime
- Task 5 (cleanup) last

**Success metrics:**
- Bundle size reduced 10-15%
- Dark mode works flawlessly
- Documentation comprehensive
- Zero hardcoded colors/styles
- Team can easily understand and extend system

---

**Labels:** `enhancement`, `design-system`, `frontend`, `documentation`, `performance`
**Milestone:** Design System Refactor Q3 2026
**Assignees:** @frontend-team
