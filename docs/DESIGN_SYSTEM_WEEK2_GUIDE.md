# Design System Refactor - Week 2 Implementation Guide

> Guide untuk refactoring large components dan membuat reusable abstractions

## 📦 Prerequisites

```bash
# Pastikan Week 1 sudah completed
# - src/design/tokens.ts exists
# - No hardcoded colors remaining

# Create folder structure
mkdir -p src/components/common
mkdir -p src/components/loan
mkdir -p src/components/members
mkdir -p src/components/settings
```

## 🎯 Strategy Overview

**Week 2 Philosophy:** "Extract, Don't Rewrite"

1. **Extract** reusable patterns → common components
2. **Split** large components → focused sub-components
3. **Preserve** all functionality (no breaking changes)
4. **Test** after each extraction

---

## 📝 Task-by-Task Implementation

### Task 1: Form Components (Start Here!)

**Why first?** Akan digunakan di semua refactoring selanjutnya.

#### Step 1.1: Create FormFieldError
```bash
cat > src/components/common/FormFieldError.tsx << 'EOF'
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormFieldErrorProps {
  children: ReactNode;
}

export function FormFieldError({ children }: FormFieldErrorProps) {
  return (
    <Text type="supporting" color="critical">
      {children}
    </Text>
  );
}
EOF
```

**Test immediately:**
```tsx
// In any existing form, replace:
<Text type="supporting" color="critical">{error}</Text>

// With:
import { FormFieldError } from '../components/common/FormFieldError';
<FormFieldError>{error}</FormFieldError>
```

#### Step 1.2: Create FormLabel
```bash
cat > src/components/common/FormLabel.tsx << 'EOF'
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormLabelProps {
  children: ReactNode;
  required?: boolean;
}

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
EOF
```

#### Step 1.3: Create FormField (Combines both)
```bash
# Copy implementation from issue to src/components/common/FormField.tsx
```

#### Step 1.4: Create barrel export
```bash
cat > src/components/common/index.ts << 'EOF'
export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';
export { FormFieldError } from './FormFieldError';
export type { FormFieldErrorProps } from './FormFieldError';
export { FormLabel } from './FormLabel';
export type { FormLabelProps } from './FormLabel';
EOF
```

**Test pattern:**
```tsx
// Before refactor
<Controller
  name="name"
  control={control}
  render={({ field }) => (
    <VStack gap={1}>
      <TextInput label="Nama" {...field} />
      {errors.name && (
        <Text type="supporting" color="critical">
          {errors.name.message}
        </Text>
      )}
    </VStack>
  )}
/>

// After refactor
<Controller
  name="name"
  control={control}
  render={({ field }) => (
    <FormField
      label="Nama"
      error={errors.name?.message}
      {...field}
    />
  )}
/>
```

**Checklist:**
- [ ] FormFieldError works in AddMemberDialog
- [ ] FormLabel shows asterisk when required
- [ ] FormField integrates with react-hook-form
- [ ] TypeScript has no errors

---

### Task 2: StatusBadge Component

```bash
# Create file
cat > src/components/common/StatusBadge.tsx << 'EOF'
import { Badge } from '@astryxdesign/core/Badge';

export type StatusType = 
  | 'Aktif' | 'Pasif' 
  | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Lunas' | 'Macet';

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const statusColors: Record<StatusType, string> = {
  'Aktif': 'success',
  'Pasif': 'secondary',
  'Menunggu': 'warning',
  'Disetujui': 'info',
  'Ditolak': 'critical',
  'Lunas': 'success',
  'Macet': 'critical',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = statusColors[status] || 'secondary';
  return <Badge color={color}>{label || status}</Badge>;
}
EOF
```

**Find & Replace in codebase:**
```bash
# Find all badge usages
grep -rn "<Badge" src/pages/ src/components/

# Replace pattern:
# Before: <Badge color="success">Aktif</Badge>
# After:  <StatusBadge status="Aktif" />
```

**Update barrel export:**
```bash
cat >> src/components/common/index.ts << 'EOF'

export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, StatusType } from './StatusBadge';
EOF
```

---

### Task 3: Refactor LoanDetailDialog

**This is the BIG one. Break it down carefully.**

#### Step 3.1: Backup original
```bash
cp src/components/LoanDetailDialog.tsx src/components/LoanDetailDialog.tsx.bak
```

#### Step 3.2: Extract LoanInfoSection (read-only info)
```tsx
// src/components/loan/LoanInfoSection.tsx
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text, Heading } from '@astryxdesign/core/Text';
import { StatusBadge } from '../common';
import { formatRp, formatDate } from '../../utils/format';
import type { LoanRow } from '../../shared/types';

export interface LoanInfoSectionProps {
  loan: LoanRow;
}

export function LoanInfoSection({ loan }: LoanInfoSectionProps) {
  return (
    <VStack gap={3} padding={4}>
      <HStack hAlign="space-between">
        <Text weight="medium">Status:</Text>
        <StatusBadge status={loan.status} />
      </HStack>
      
      <HStack hAlign="space-between">
        <Text weight="medium">Jumlah Pinjaman:</Text>
        <Text>{formatRp(loan.amount)}</Text>
      </HStack>
      
      <HStack hAlign="space-between">
        <Text weight="medium">Tenor:</Text>
        <Text>{loan.tenor} bulan</Text>
      </HStack>
      
      {/* Add other fields... */}
    </VStack>
  );
}
```

#### Step 3.3: Test LoanInfoSection in isolation
```tsx
// Add temporary test in original LoanDetailDialog
import { LoanInfoSection } from './loan/LoanInfoSection';

// Replace info rendering section with:
<LoanInfoSection loan={loan} />
```

**Test:** Open loan detail dialog, verify info displays correctly.

#### Step 3.4: Extract LoanScheduleTable
```tsx
// src/components/loan/LoanScheduleTable.tsx
import { Table } from '@astryxdesign/core/Table';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { LoanSchedule } from '../../shared/types';

export interface LoanScheduleTableProps {
  loanId: number;
  onUpdate: () => void;
}

export function LoanScheduleTable({ loanId, onUpdate }: LoanScheduleTableProps) {
  const { data: schedules, isLoading } = useApiQuery<LoanSchedule[]>(
    `/api/loans/${loanId}/schedule`
  );
  
  // Table columns definition
  const columns = [ /* ... */ ];
  
  // Edit schedule logic
  const handleEdit = () => { /* ... */ };
  
  return (
    <Table 
      columns={columns}
      data={schedules || []}
      isLoading={isLoading}
    />
  );
}
```

#### Step 3.5: Extract LoanPaymentForm
```tsx
// src/components/loan/LoanPaymentForm.tsx
import { useForm } from 'react-hook-form';
import { FormField } from '../common';
import { Button } from '@astryxdesign/core/Button';

export interface LoanPaymentFormProps {
  loanId: number;
  onSuccess: () => void;
}

export function LoanPaymentForm({ loanId, onSuccess }: LoanPaymentFormProps) {
  const { control, handleSubmit, errors } = useForm();
  
  const onSubmit = async (data) => {
    // Payment logic
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField
        name="amount"
        label="Jumlah Bayar"
        error={errors.amount?.message}
      />
      {/* More fields... */}
      <Button type="submit">Catat Pembayaran</Button>
    </form>
  );
}
```

#### Step 3.6: Compose main LoanDetailDialog
```tsx
// src/components/LoanDetailDialog.tsx (refactored)
import { Dialog } from '@astryxdesign/core/Dialog';
import { Tabs, Tab } from '@astryxdesign/core/Tabs';
import { LoanInfoSection } from './loan/LoanInfoSection';
import { LoanScheduleTable } from './loan/LoanScheduleTable';
import { LoanPaymentForm } from './loan/LoanPaymentForm';

export function LoanDetailDialogContent({ loan, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('info');
  
  return (
    <Dialog title={`Pinjaman - ${loan.memberName}`} onClose={onClose}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="info" label="Informasi" />
        <Tab value="schedule" label="Jadwal" />
        <Tab value="payment" label="Pembayaran" />
      </Tabs>
      
      {activeTab === 'info' && <LoanInfoSection loan={loan} />}
      {activeTab === 'schedule' && <LoanScheduleTable loanId={loan.id} onUpdate={onUpdate} />}
      {activeTab === 'payment' && <LoanPaymentForm loanId={loan.id} onSuccess={onUpdate} />}
    </Dialog>
  );
}
```

**Checklist:**
- [ ] All tabs work correctly
- [ ] Payment form submits successfully
- [ ] Schedule table displays and edits work
- [ ] Info section shows all data
- [ ] No functionality lost
- [ ] Main file < 200 LOC

---

### Task 4: Refactor Members.tsx

**Strategy:** Extract rendering logic, keep data fetching in page.

#### Step 4.1: Extract MembersFilters
```tsx
// src/components/members/MembersFilters.tsx
export interface MembersFiltersProps {
  search: string;
  status: string;
  role: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onAdd: () => void;
  onExport: () => void;
}

export function MembersFilters({ 
  search, status, role, 
  onSearchChange, onStatusChange, onRoleChange,
  onAdd, onExport 
}: MembersFiltersProps) {
  return (
    <HStack gap={2} padding={4}>
      <TextInput 
        placeholder="Cari nama..."
        value={search}
        onChange={onSearchChange}
      />
      <Selector
        value={status}
        onChange={onStatusChange}
        options={STATUS_OPTIONS}
      />
      {/* ... */}
      <Button onClick={onAdd}>Tambah Anggota</Button>
    </HStack>
  );
}
```

#### Step 4.2: Extract MemberActions
```tsx
// src/components/members/MemberActions.tsx
export interface MemberActionsProps {
  member: MemberRow;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateSavings: () => void;
  // ... other actions
}

export function MemberActions({ member, ...handlers }: MemberActionsProps) {
  const { hasPermission } = useAuth();
  
  return (
    <HStack gap={1}>
      {hasPermission('members.update') && (
        <IconButton icon={<PencilIcon />} onClick={handlers.onEdit} />
      )}
      {/* ... other buttons */}
    </HStack>
  );
}
```

#### Step 4.3: Extract MembersList
```tsx
// src/components/members/MembersList.tsx
import { Table } from '@astryxdesign/core/Table';
import { MemberActions } from './MemberActions';

export interface MembersListProps {
  members: MemberRow[];
  isLoading: boolean;
  onEdit: (member: MemberRow) => void;
  onDelete: (member: MemberRow) => void;
  // ... handlers
}

export function MembersList({ members, isLoading, ...handlers }: MembersListProps) {
  const columns = [
    // Column definitions...
    {
      header: 'Aksi',
      render: (member) => <MemberActions member={member} {...handlers} />
    }
  ];
  
  return <Table columns={columns} data={members} isLoading={isLoading} />;
}
```

#### Step 4.4: Compose Members.tsx
```tsx
// src/pages/Members.tsx (refactored)
import { MembersFilters } from '../components/members/MembersFilters';
import { MembersList } from '../components/members/MembersList';

export default function MembersPage() {
  // Data fetching
  const { data, isLoading, refetch } = useMembers();
  
  // Filter state
  const [filters, setFilters] = useState({...});
  
  // Action handlers
  const handleEdit = (member) => { dialog.show(...) };
  // ...
  
  return (
    <Layout>
      <MembersFilters 
        {...filters}
        onSearchChange={(v) => setFilters({...filters, search: v})}
        onAdd={handleAdd}
      />
      
      <MembersList
        members={data?.items || []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </Layout>
  );
}
```

---

### Task 5 & 6: Similar Pattern

Follow same strategy as Members:
1. Backup original
2. Extract UI components (filters, lists, forms)
3. Keep data/state in page component
4. Test each extraction
5. Compose back together

---

## 🧪 Testing Strategy

### Unit-ish Testing (Manual)

After each component extraction:

```bash
# Start dev server
bun run dev

# Test checklist per component:
# 1. Component renders without errors
# 2. Props are passed correctly
# 3. Event handlers fire
# 4. Visual appearance unchanged
# 5. TypeScript compiles without errors
```

### Integration Testing

After composing refactored component:

```bash
# Full page testing:
# 1. All features work (CRUD operations)
# 2. Dialogs open/close correctly
# 3. Forms submit successfully
# 4. API calls complete
# 5. Toast messages appear
# 6. Loading states work
# 7. Error handling preserved
```

### Visual Regression

```bash
# Before refactor: take screenshots
# After refactor: compare screenshots
# Should be pixel-perfect identical
```

---

## 🚨 Common Pitfalls

### ❌ Pitfall 1: Over-abstraction
```tsx
// ❌ DON'T: Too generic, hard to use
<GenericForm fields={[...]} onSubmit={...} />

// ✅ DO: Specific, clear purpose
<AddMemberForm onSubmit={...} />
```

### ❌ Pitfall 2: Prop Drilling Hell
```tsx
// ❌ DON'T: Passing too many props through layers
<Parent onA={} onB={} onC={} onD={} onE={} />

// ✅ DO: Group related handlers
<Parent actions={{ onEdit, onDelete, onUpdate }} />
```

### ❌ Pitfall 3: State in Wrong Place
```tsx
// ❌ DON'T: Data fetching in leaf component
function MembersList() {
  const { data } = useApiQuery('/api/members'); // ❌
  return <Table data={data} />;
}

// ✅ DO: Data fetching in page, pass as props
function MembersPage() {
  const { data } = useApiQuery('/api/members'); // ✅
  return <MembersList members={data} />;
}
```

### ❌ Pitfall 4: Breaking TypeScript Types
```tsx
// ❌ DON'T: Lose type safety
function FormField(props: any) { ... }

// ✅ DO: Explicit interfaces
interface FormFieldProps {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}
```

---

## 📊 Progress Tracking

| Component | Original LOC | Target LOC | Sub-components | Status |
|-----------|--------------|------------|----------------|--------|
| LoanDetailDialog | 919 | 150 | 4 | ⬜ Todo |
| Members.tsx | 545 | 200 | 3 | ⬜ Todo |
| Settings.tsx | 543 | 150 | 3 | ⬜ Todo |
| MemberPortal.tsx | 714 | 200 | 3 | ⬜ Optional |

**Common Components:**
- [ ] FormField, FormFieldError, FormLabel
- [ ] StatusBadge
- [ ] (Future: DataTable, EmptyState, LoadingCard)

---

## ✅ Definition of Done (Per Component)

- [ ] Original file backed up (`.tsx.bak`)
- [ ] Sub-components created and tested individually
- [ ] Main component reduced to target LOC
- [ ] All functionality preserved (manual test)
- [ ] TypeScript compiles with no errors
- [ ] No console warnings
- [ ] Visual regression check passed
- [ ] Committed with descriptive message

---

## 🎯 Commit Message Template

```
refactor(components): split [ComponentName] into focused sub-components

- Extract [SubComponent1] - handles [responsibility]
- Extract [SubComponent2] - handles [responsibility]
- Main component now orchestrates sub-components
- Reduced from [X] LOC to [Y] LOC
- No functional changes

Test: All features work identically to before refactor
```

---

## 🔗 Useful Commands

```bash
# Count lines of code
wc -l src/components/LoanDetailDialog.tsx

# Find all usages of a component
grep -rn "LoanDetailDialog" src/

# Check TypeScript errors
bun run typecheck

# Build to catch errors
bun run build
```

Good luck with the refactoring! Remember: **Extract, Test, Commit, Repeat**. 🚀
