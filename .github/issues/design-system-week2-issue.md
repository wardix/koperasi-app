# [Design System] Refactor large components and create reusable abstractions

## 🎨 Deskripsi

Week 1 sudah membersihkan hardcoded colors dan membuat design token system. Week 2 fokus pada **architectural improvements**: memecah komponen besar (500+ LOC) menjadi sub-komponen yang testable, dan membuat abstraksi reusable untuk pattern yang berulang.

**Masalah:**
- 4 komponen berukuran 500+ LOC (sulit di-maintain dan test)
- Pattern berulang (form fields dengan validation, status badges, error display) tidak di-abstraksi
- Business logic tercampur dengan UI logic
- Tidak ada component library internal untuk pattern yang konsisten

## 🎯 Goal Week 2

Meningkatkan maintainability dan reusability dengan refactoring komponen monolitik dan membuat reusable component abstractions.

---

## ✅ Task List

### Task 1: Create Reusable Form Components

**Files to create:**
- `src/components/common/FormField.tsx`
- `src/components/common/FormFieldError.tsx`
- `src/components/common/FormLabel.tsx`

**Implementation:**

#### `src/components/common/FormField.tsx`
```tsx
import { VStack } from '@astryxdesign/core/Stack';
import { TextInput, type TextInputProps } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { FormLabel } from './FormLabel';
import { FormFieldError } from './FormFieldError';

export interface FormFieldProps extends Omit<TextInputProps, 'label'> {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
}

/**
 * Reusable form field with label, input, description, and error display.
 * Integrates with react-hook-form and Astryx design system.
 */
export function FormField({
  label,
  error,
  required,
  description,
  ...inputProps
}: FormFieldProps) {
  return (
    <VStack gap={1}>
      <FormLabel required={required}>{label}</FormLabel>
      <TextInput {...inputProps} />
      {description && !error && (
        <Text type="supporting" color="secondary">
          {description}
        </Text>
      )}
      {error && <FormFieldError>{error}</FormFieldError>}
    </VStack>
  );
}
```

#### `src/components/common/FormFieldError.tsx`
```tsx
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormFieldErrorProps {
  children: ReactNode;
}

/**
 * Consistent error message display for form fields.
 * Uses semantic color from design system.
 */
export function FormFieldError({ children }: FormFieldErrorProps) {
  return (
    <Text type="supporting" color="critical">
      {children}
    </Text>
  );
}
```

#### `src/components/common/FormLabel.tsx`
```tsx
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormLabelProps {
  children: ReactNode;
  required?: boolean;
}

/**
 * Form label with optional required indicator.
 */
export function FormLabel({ children, required }: FormLabelProps) {
  return (
    <Text type="label" weight="medium">
      {children}
      {required && (
        <Text type="label" color="critical" style={{ marginLeft: 4 }}>
          *
        </Text>
      )}
    </Text>
  );
}
```

**Acceptance Criteria:**
- [ ] 3 form component files created
- [ ] TypeScript interfaces exported
- [ ] JSDoc comments for each component
- [ ] Consistent with Astryx design patterns
- [ ] No hardcoded styles (use design tokens)

---

### Task 2: Create Status Badge Component

**File:** `src/components/common/StatusBadge.tsx`

**Implementation:**
```tsx
import { Badge } from '@astryxdesign/core/Badge';
import { semanticColors } from '../../design/tokens';

export type StatusType = 
  | 'Aktif' | 'Pasif' 
  | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Lunas' | 'Macet'
  | 'success' | 'error' | 'warning' | 'info';

export interface StatusBadgeProps {
  status: StatusType;
  /** Override default label (useful for translations) */
  label?: string;
}

const statusConfig: Record<StatusType, { color: string; variant?: string }> = {
  // Member status
  'Aktif': { color: 'success' },
  'Pasif': { color: 'secondary' },
  
  // Loan status
  'Menunggu': { color: 'warning' },
  'Disetujui': { color: 'info' },
  'Ditolak': { color: 'critical' },
  'Lunas': { color: 'success' },
  'Macet': { color: 'critical' },
  
  // Generic status
  'success': { color: 'success' },
  'error': { color: 'critical' },
  'warning': { color: 'warning' },
  'info': { color: 'info' },
};

/**
 * Consistent status badge for members, loans, and other entities.
 * Automatically maps status to appropriate semantic color.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] || { color: 'secondary' };
  
  return (
    <Badge color={config.color}>
      {label || status}
    </Badge>
  );
}
```

**Acceptance Criteria:**
- [ ] File created with all status types supported
- [ ] Type-safe status mapping
- [ ] Used semantic colors from tokens
- [ ] JSDoc documentation

---

### Task 3: Refactor LoanDetailDialog (919 LOC → 3-4 sub-components)

**Current issue:** Komponen ini terlalu besar dan menangani terlalu banyak concern.

**New structure:**
```
src/components/loan/
├── LoanDetailDialog.tsx (main orchestrator, ~150 LOC)
├── LoanInfoSection.tsx (loan metadata display, ~100 LOC)
├── LoanScheduleTable.tsx (installment schedule, ~200 LOC)
├── LoanPaymentForm.tsx (payment recording form, ~150 LOC)
└── LoanScheduleEditor.tsx (edit schedules, ~200 LOC)
```

**Implementation strategy:**

#### `src/components/loan/LoanDetailDialog.tsx` (refactored)
```tsx
import { Dialog } from '@astryxdesign/core/Dialog';
import { Tabs, Tab } from '@astryxdesign/core/Tabs';
import { LoanInfoSection } from './LoanInfoSection';
import { LoanScheduleTable } from './LoanScheduleTable';
import { LoanPaymentForm } from './LoanPaymentForm';
import type { LoanRow } from '../../shared/types';

export interface LoanDetailDialogProps {
  loan: LoanRow;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

/**
 * Main loan detail dialog with tabbed interface.
 * Delegates specific concerns to focused sub-components.
 */
export function LoanDetailDialog({ loan, isOpen, onClose, onUpdate }: LoanDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('info');
  
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Detail Pinjaman - ${loan.memberName}`}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="info" label="Informasi" />
        <Tab value="schedule" label="Jadwal Angsuran" />
        <Tab value="payment" label="Catat Pembayaran" />
      </Tabs>
      
      {activeTab === 'info' && <LoanInfoSection loan={loan} />}
      {activeTab === 'schedule' && <LoanScheduleTable loan={loan} onUpdate={onUpdate} />}
      {activeTab === 'payment' && <LoanPaymentForm loan={loan} onSuccess={onUpdate} />}
    </Dialog>
  );
}
```

#### `src/components/loan/LoanInfoSection.tsx`
- Display loan metadata (amount, tenor, rate, etc.)
- Status badge
- Member info
- Approval/disbursement dates
- Read-only, no forms

#### `src/components/loan/LoanScheduleTable.tsx`
- Table of installment schedules
- Show principal, interest, paid amount
- Edit schedule functionality
- Handle schedule regeneration

#### `src/components/loan/LoanPaymentForm.tsx`
- Form untuk catat pembayaran angsuran
- Amount input dengan validation
- Payment date picker
- Submit handler

**Acceptance Criteria:**
- [ ] `LoanDetailDialog.tsx` reduced to ~150 LOC (orchestrator only)
- [ ] 3-4 focused sub-components created in `src/components/loan/`
- [ ] Each sub-component handles single concern
- [ ] Props properly typed with TypeScript
- [ ] Business logic separated from UI rendering
- [ ] All functionality from original component preserved
- [ ] Manual testing: detail dialog works identically to before

---

### Task 4: Refactor Members.tsx (545 LOC → 3 sub-components)

**Current issue:** Satu file menangani list, filters, dialogs, dan actions.

**New structure:**
```
src/pages/Members.tsx (main page, ~200 LOC)
src/components/members/
├── MembersList.tsx (table rendering, ~150 LOC)
├── MembersFilters.tsx (search, status, role filters, ~100 LOC)
└── MemberActions.tsx (action buttons per row, ~80 LOC)
```

**Implementation strategy:**

#### `src/pages/Members.tsx` (refactored)
```tsx
import { MembersList } from '../components/members/MembersList';
import { MembersFilters } from '../components/members/MembersFilters';
import { Layout, LayoutHeader, LayoutContent } from '@astryxdesign/core/Layout';
import { Heading } from '@astryxdesign/core/Text';
// ... dialog imports

export default function MembersPage() {
  const [filters, setFilters] = useState({ search: '', status: '', role: '' });
  const { data, isLoading, refetch } = useMembers(filters);
  
  // Dialog handlers
  const handleAdd = () => { /* ... */ };
  const handleEdit = (member) => { /* ... */ };
  const handleDelete = (member) => { /* ... */ };
  
  return (
    <Layout>
      <LayoutHeader>
        <Heading level={1}>Anggota</Heading>
      </LayoutHeader>
      
      <MembersFilters filters={filters} onChange={setFilters} />
      
      <LayoutContent>
        <MembersList 
          members={data?.items || []}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateSavings={handleUpdateSavings}
          // ... other handlers
        />
      </LayoutContent>
      
      {/* Dialog components */}
    </Layout>
  );
}
```

#### `src/components/members/MembersList.tsx`
- Table rendering dengan columns definition
- Row actions (edit, delete, update savings, etc.)
- Loading & empty states
- Pagination
- **No data fetching** (receives data as props)

#### `src/components/members/MembersFilters.tsx`
- Search input
- Status selector
- Role selector
- Export button
- Add member button
- **No state management** (controlled component)

#### `src/components/members/MemberActions.tsx`
- IconButton group untuk actions per member
- Edit, Delete, Update Savings, Portal Access, Preview buttons
- Permission checks
- Tooltips

**Acceptance Criteria:**
- [ ] `Members.tsx` reduced to ~200 LOC
- [ ] 3 focused components created in `src/components/members/`
- [ ] Data fetching stays in page component
- [ ] UI components are "dumb" (receive props, emit events)
- [ ] All features work identically to before
- [ ] Manual testing passed

---

### Task 5: Refactor Settings.tsx (543 LOC → 3 sub-components)

**Current issue:** Profile settings, parameter settings, dan 2FA logic dalam satu file.

**New structure:**
```
src/pages/Settings.tsx (main page with tabs, ~150 LOC)
src/components/settings/
├── ProfileSettings.tsx (~120 LOC)
├── ParameterSettings.tsx (~150 LOC)
└── TwoFactorSettings.tsx (~120 LOC)
```

**Implementation strategy:**

#### `src/pages/Settings.tsx` (refactored)
```tsx
import { Tabs, Tab } from '@astryxdesign/core/Tabs';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { ParameterSettings } from '../components/settings/ParameterSettings';
import { TwoFactorSettings } from '../components/settings/TwoFactorSettings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { data: settings, refetch } = useSettings();
  
  return (
    <Layout>
      <LayoutHeader>
        <Heading level={1}>Pengaturan</Heading>
      </LayoutHeader>
      
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="profile" label="Profil Koperasi" />
        <Tab value="parameters" label="Parameter Sistem" />
        <Tab value="2fa" label="Two-Factor Auth" />
      </Tabs>
      
      <LayoutContent>
        {activeTab === 'profile' && <ProfileSettings settings={settings} onUpdate={refetch} />}
        {activeTab === 'parameters' && <ParameterSettings settings={settings} onUpdate={refetch} />}
        {activeTab === '2fa' && <TwoFactorSettings />}
      </LayoutContent>
    </Layout>
  );
}
```

#### `src/components/settings/ProfileSettings.tsx`
- Koperasi name
- Logo upload (future)
- Contact info
- Save handler

#### `src/components/settings/ParameterSettings.tsx`
- Simpanan wajib bulanan
- Suku bunga default
- Tenor maksimal
- SHU allocation percentages
- Save handler

#### `src/components/settings/TwoFactorSettings.tsx`
- Enable/disable 2FA
- QR code display
- Recovery codes
- Verification form

**Acceptance Criteria:**
- [ ] `Settings.tsx` reduced to ~150 LOC
- [ ] 3 settings components created in `src/components/settings/`
- [ ] Each tab is self-contained component
- [ ] Settings data passed as props
- [ ] Update callbacks properly handled
- [ ] All features preserved

---

### Task 6: Create Common Component Index

**File:** `src/components/common/index.ts`

**Implementation:**
```typescript
/**
 * Common reusable components for the Koperasi app.
 * Import from this barrel file for cleaner imports.
 */

export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';

export { FormFieldError } from './FormFieldError';
export type { FormFieldErrorProps } from './FormFieldError';

export { FormLabel } from './FormLabel';
export type { FormLabelProps } from './FormLabel';

export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, StatusType } from './StatusBadge';
```

**Usage example:**
```tsx
// ✅ Clean imports
import { FormField, StatusBadge } from '../components/common';

// Instead of:
// ❌ Verbose imports
import { FormField } from '../components/common/FormField';
import { StatusBadge } from '../components/common/StatusBadge';
```

**Acceptance Criteria:**
- [ ] Barrel export file created
- [ ] All common components exported
- [ ] Types re-exported
- [ ] JSDoc comment explaining purpose

---

## 📸 Testing Checklist

**For each refactored component:**

### Functional Testing
- [ ] All features work identically to before refactor
- [ ] Form validation works correctly
- [ ] API calls succeed
- [ ] Error handling preserved
- [ ] Loading states display properly
- [ ] Toast notifications appear correctly

### Visual Regression
- [ ] Take before/after screenshots for:
  - Members page (list, filters, dialogs)
  - Loan detail dialog (all tabs)
  - Settings page (all tabs)
- [ ] No unintended visual changes
- [ ] Responsive behavior preserved

### Code Quality
- [ ] No console errors or warnings
- [ ] TypeScript types properly defined
- [ ] Props documented with JSDoc
- [ ] Components follow single responsibility principle
- [ ] Business logic separated from UI

### Developer Experience
- [ ] Component names are clear and descriptive
- [ ] Props interfaces are well-typed
- [ ] File organization makes sense
- [ ] Easy to locate specific functionality

---

## 📚 Resources

- [React Component Composition](https://react.dev/learn/passing-props-to-a-component)
- [Separation of Concerns](https://kentcdodds.com/blog/colocation)
- [Astryx Component Patterns](https://astryx.atmeta.com/docs/patterns)
- [TypeScript Component Props](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/basic_type_example)

---

## 🔍 Definition of Done

- [ ] All 6 tasks completed
- [ ] 4 large components refactored (LoanDetailDialog, Members, Settings, MemberPortal optional)
- [ ] 3+ reusable components created in `src/components/common/`
- [ ] All manual tests passed
- [ ] No functional regressions
- [ ] Code review completed
- [ ] PR merged

---

## 💡 Notes

- **Prioritas:** High (improves maintainability significantly)
- **Estimated effort:** 10-12 jam
- **Breaking changes:** None (internal refactor)
- **Dependencies:** Week 1 should be completed (design tokens available)
- **Optional:** MemberPortal.tsx (714 LOC) bisa direfactor jika ada waktu

**Testing strategy:**
- Refactor satu komponen pada satu waktu
- Test thoroughly sebelum move ke komponen berikutnya
- Keep original file backup temporarily (`*.tsx.bak`)
- Commit setelah setiap komponen berhasil direfactor

---

**Labels:** `enhancement`, `design-system`, `frontend`, `refactoring`
**Milestone:** Design System Refactor Q3 2026
**Assignees:** @frontend-team
