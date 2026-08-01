# ✅ Design System Week 2 Issue Created

**Date:** 2026-08-01  
**Issue Number:** #264  
**Status:** Open

---

## 🔗 Issue Link

**https://github.com/wardix/koperasi-app/issues/264**

---

## 📋 Issue Details

**Title:**  
`[Design System] Refactor large components and create reusable abstractions`

**Labels:**
- `enhancement`
- `design-system`
- `frontend`
- `refactoring`

**Assignee:** @wardix

**State:** Open

---

## 🎯 Week 2 Goals

### Primary Objective
Improve code maintainability by splitting monolithic components (500+ LOC) into focused, testable sub-components and creating reusable component abstractions.

### Targets
1. **Create reusable components:** FormField, StatusBadge, FormFieldError
2. **Refactor 4 large components:**
   - `LoanDetailDialog.tsx` (919 LOC → ~150 LOC + 4 sub-components)
   - `Members.tsx` (545 LOC → ~200 LOC + 3 sub-components)
   - `Settings.tsx` (543 LOC → ~150 LOC + 3 sub-components)
   - `MemberPortal.tsx` (714 LOC → optional)

---

## ✅ Task Breakdown

### Task 1: Reusable Form Components (Foundation)
**Estimated:** 1.5 hours

Create common form components untuk eliminate duplication:
- `FormField.tsx` - Integrated field dengan label, input, error
- `FormFieldError.tsx` - Consistent error display
- `FormLabel.tsx` - Label dengan required indicator
- `index.ts` - Barrel export

**Impact:** Digunakan di semua dialog forms (Members, Loans, Settings)

---

### Task 2: StatusBadge Component
**Estimated:** 30 minutes

Centralized status badge dengan semantic colors:
- Member status: Aktif, Pasif
- Loan status: Menunggu, Disetujui, Ditolak, Lunas, Macet
- Type-safe status mapping

**Impact:** Consistent status display across app

---

### Task 3: Refactor LoanDetailDialog
**Estimated:** 4 hours

**Problem:** 919 LOC monolith with mixed concerns

**Solution:**
```
LoanDetailDialog.tsx (~150 LOC)  ← orchestrator
├── LoanInfoSection.tsx (~100 LOC)  ← read-only info
├── LoanScheduleTable.tsx (~200 LOC)  ← schedule display/edit
├── LoanPaymentForm.tsx (~150 LOC)  ← payment recording
└── LoanScheduleEditor.tsx (~200 LOC)  ← edit schedules
```

**Benefit:** Easier to test, maintain, and extend each concern

---

### Task 4: Refactor Members.tsx
**Estimated:** 2.5 hours

**Problem:** 545 LOC page handling list, filters, and dialogs

**Solution:**
```
Members.tsx (~200 LOC)  ← data fetching & orchestration
├── MembersList.tsx (~150 LOC)  ← table rendering
├── MembersFilters.tsx (~100 LOC)  ← search, status, role filters
└── MemberActions.tsx (~80 LOC)  ← action buttons per row
```

**Benefit:** Clear separation: page = data, components = UI

---

### Task 5: Refactor Settings.tsx
**Estimated:** 2 hours

**Problem:** 543 LOC with 3 different settings sections

**Solution:**
```
Settings.tsx (~150 LOC)  ← tabs & orchestration
├── ProfileSettings.tsx (~120 LOC)  ← koperasi profile
├── ParameterSettings.tsx (~150 LOC)  ← system parameters
└── TwoFactorSettings.tsx (~120 LOC)  ← 2FA configuration
```

**Benefit:** Each settings section self-contained

---

### Task 6: Component Index
**Estimated:** 15 minutes

Create barrel export untuk clean imports:
```typescript
// src/components/common/index.ts
export { FormField, StatusBadge, ... } from './...';
```

**Usage:**
```tsx
// ✅ Clean
import { FormField, StatusBadge } from '../components/common';

// ❌ Verbose
import { FormField } from '../components/common/FormField';
import { StatusBadge } from '../components/common/StatusBadge';
```

---

## 📊 Metrics

### Code Reduction
| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| LoanDetailDialog | 919 LOC | 150 LOC | -84% |
| Members | 545 LOC | 200 LOC | -63% |
| Settings | 543 LOC | 150 LOC | -72% |
| **Total** | **2,007 LOC** | **500 LOC** | **-75%** |

### Component Creation
- **3 common components** (reusable across app)
- **10 focused sub-components** (single responsibility)
- **1 barrel export** (clean imports)

### Maintainability Impact
- ✅ Easier to locate specific functionality
- ✅ Simpler to test individual concerns
- ✅ Less cognitive load per file
- ✅ Clearer component boundaries
- ✅ Reusable patterns extracted

---

## 📸 Testing Strategy

### Per-Component Testing
After each extraction:
1. Component renders without errors
2. Props passed correctly
3. Event handlers fire
4. Visual appearance unchanged
5. TypeScript compiles

### Integration Testing
After composing refactored component:
1. All CRUD operations work
2. Dialogs open/close
3. Forms submit successfully
4. API calls complete
5. Toast messages appear
6. Loading/error states work

### Visual Regression
- Take before/after screenshots
- Compare pixel-perfect
- Document any intentional changes

---

## 🚀 Implementation Order

**Recommended sequence:**

1. **Week 1 must be complete first**
   - Design tokens available
   - No hardcoded colors

2. **Start with Task 1 (Form Components)**
   - Foundation for everything else
   - Test in existing dialogs immediately

3. **Task 2 (StatusBadge)**
   - Quick win
   - Used in multiple places

4. **Task 3 (LoanDetailDialog)**
   - Largest component
   - Most impact
   - Test thoroughly before moving on

5. **Tasks 4-5 (Members, Settings)**
   - Follow same pattern as Task 3
   - Should be faster with experience

6. **Task 6 (Index)**
   - Final cleanup
   - Update all imports

---

## 📚 Documentation

### Implementation Guide
**File:** `docs/DESIGN_SYSTEM_WEEK2_GUIDE.md` (663 lines)

**Contents:**
- Step-by-step implementation per task
- Code examples with before/after
- Testing strategy per component
- Common pitfalls and solutions
- Progress tracking checklist
- Commit message templates

### Key Principles

**1. Extract, Don't Rewrite**
- Preserve all functionality
- No breaking changes
- Incremental improvements

**2. Single Responsibility**
- Each component does one thing well
- Clear boundaries
- Easy to reason about

**3. Test After Each Step**
- Don't pile up changes
- Catch issues early
- Build confidence incrementally

**4. Separation of Concerns**
- Data fetching in pages
- UI rendering in components
- Business logic in services

---

## 🔍 Verification Commands

```bash
# View issue
gh issue view 264

# Add progress comment
gh issue comment 264 --body "✅ Task 1 complete: Form components created"

# Check file sizes
wc -l src/components/LoanDetailDialog.tsx
wc -l src/pages/Members.tsx
wc -l src/pages/Settings.tsx

# Verify TypeScript
bun run typecheck

# Test build
bun run build
```

---

## 💡 Success Criteria

### Code Quality
- [ ] All large components split into sub-components
- [ ] Each file < 200 LOC (orchestrators) or < 250 LOC (sub-components)
- [ ] Reusable components created and documented
- [ ] TypeScript types properly defined
- [ ] No console errors/warnings

### Functionality
- [ ] All features work identically to before
- [ ] No visual regressions
- [ ] Forms submit correctly
- [ ] Dialogs open/close properly
- [ ] API calls succeed

### Developer Experience
- [ ] Clear component names
- [ ] Well-typed props
- [ ] JSDoc documentation
- [ ] Logical file organization
- [ ] Easy to locate functionality

---

## 🔗 Dependencies

**Prerequisite:**
- Issue #263 (Week 1) must be completed
- Design tokens (`src/design/tokens.ts`) available

**Blocks:**
- Issue #265 (Week 3) depends on this

---

## 📅 Timeline

**Estimated total effort:** 10-12 hours

**Breakdown:**
- Task 1 (Forms): 1.5 hours
- Task 2 (Badge): 0.5 hours
- Task 3 (Loan): 4 hours
- Task 4 (Members): 2.5 hours
- Task 5 (Settings): 2 hours
- Task 6 (Index): 0.25 hours
- Testing & polish: 1.25 hours

**Suggested schedule:**
- Day 1 (4 hours): Tasks 1, 2, start Task 3
- Day 2 (4 hours): Finish Task 3, start Task 4
- Day 3 (3 hours): Tasks 4, 5, 6, testing

---

## 🎯 Next Steps (Week 3)

After Week 2 completion:
1. Integrate chart colors with theme tokens
2. Consolidate theme management (Astryx vs custom)
3. Create component documentation/storybook
4. Performance optimization (memoization, lazy loading)
5. Add component unit tests

---

## 📞 Support

**Implementation questions:**  
→ Comment on issue #264

**Refactoring patterns:**  
→ Check `docs/DESIGN_SYSTEM_WEEK2_GUIDE.md`

**Design review needed:**  
→ Tag @design-team in PR

**Stuck or blocker:**  
→ Escalate in standup

---

**Created by:** Kiro AI Assistant  
**Command used:** `gh issue create` + `gh api`  
**Repository:** wardix/koperasi-app  
**Related:** Issue #263 (Week 1), Future #265 (Week 3)
