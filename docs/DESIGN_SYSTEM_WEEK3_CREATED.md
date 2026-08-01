# ✅ Design System Week 3 Issue Created

**Date:** 2026-08-01  
**Issue Number:** #265  
**Status:** Open

---

## 🔗 Issue Link

**https://github.com/wardix/koperasi-app/issues/265**

---

## 📋 Issue Details

**Title:**  
`[Design System] Integration, optimization, and documentation`

**Labels:**
- `enhancement`
- `design-system`
- `frontend`
- `documentation`
- `performance`

**Assignee:** @wardix

**State:** Open

---

## 🎯 Week 3 Goals

### Primary Objective
**Final polish** untuk design system: integrasikan semua component dengan theme, optimisasi performance, dan dokumentasi komprehensif untuk long-term maintainability.

### Key Deliverables
1. **Chart Integration** - Recharts terintegrasi dengan design tokens
2. **Theme Consolidation** - Single source of truth (Astryx Theme)
3. **Performance Optimization** - Memoization, lazy loading, bundle size reduction
4. **Comprehensive Documentation** - Component library, tokens, patterns
5. **Final Cleanup** - Remove remaining inconsistencies

---

## ✅ Task Breakdown

### Task 1: Integrate Chart Colors (2-3 hours)

**Problem:** Charts (Recharts) masih menggunakan hardcoded colors

**Solution:**
- Create `src/design/chartTheme.ts` dengan helpers
- Update App.tsx dashboard charts
- Update Reports.tsx report charts  
- Update SHU.tsx pie chart

**Files:**
- `src/design/chartTheme.ts` (new)
- `src/App.tsx`
- `src/pages/Reports.tsx`
- `src/pages/SHU.tsx`

**Impact:** Charts respect dark mode, colors consistent

---

### Task 2: Consolidate Theme Management (1.5 hours)

**Problem:** Duplikasi theme logic (Astryx + custom ThemeContext)

**Solution:**
- Simplify ThemeContext (remove system mode, resolvedMode)
- Use Astryx Theme as single source of truth
- Clean up theme application logic

**Files:**
- `src/contexts/ThemeContext.tsx`
- `src/main.tsx`
- `src/components/Shell.tsx`

**Impact:** Cleaner architecture, less confusion

---

### Task 3: Performance Optimization (2-3 hours)

**Optimizations:**
1. **Memoize table columns** (7 pages)
2. **Memoize heavy calculations** (SHU, NPL, Reports)
3. **Lazy load large dialogs** (4 dialogs)
4. **Optimize icon imports** (named imports only)

**Expected Results:**
- Bundle size reduced 10-15%
- Fewer unnecessary re-renders
- Faster initial load

**Files to optimize:**
- Pages: Members, Loans, SHU, NPL, Reports, Savings, LoansTx, Cashflow, Expenses
- Dialogs: LoanDetailDialog, ImportSavingsDialog, AddLoanDialog, AddMemberDialog

---

### Task 4: Comprehensive Documentation (2-3 hours)

**Documents to create:**

#### `docs/COMPONENTS.md` (~400 lines)
- FormField component reference
- StatusBadge component reference
- FormFieldError, FormLabel
- Component architecture guide
- Creating new components checklist

#### `docs/DESIGN_TOKENS.md` (~300 lines)
- Semantic colors table
- Spacing, radius reference
- Helper functions documentation
- Best practices (do/don't)
- Adding new tokens guide

#### `docs/PATTERNS.md` (~400 lines)
- Separation of concerns pattern
- Form patterns (react-hook-form)
- Chart patterns (Recharts)
- Performance patterns (memoization, lazy loading)
- API patterns (useApiQuery, useApiAction)
- Table patterns
- Error handling patterns
- Code style guide

**Impact:** Team dapat understand dan extend system dengan mudah

---

### Task 5: Final Cleanup & Polish (1 hour)

**Cleanup tasks:**
- Remove remaining unjustified inline styles (target: < 10)
- Clean up unused imports (oxlint)
- Review and document CSS files
- Update README with design system section

**README additions:**
- Design System overview
- Architecture explanation
- Documentation links
- Development guidelines
- Adding new features guide

---

## 📊 Metrics & Expected Outcomes

### Code Quality
| Metric | Before Week 3 | After Week 3 |
|--------|---------------|--------------|
| Hardcoded colors | 0 (from Week 1) | 0 |
| Inline styles | ~50 | < 10 |
| Unused imports | ~20 | 0 |
| Bundle size | Baseline | -10-15% |

### Documentation
| Document | Lines | Status |
|----------|-------|--------|
| COMPONENTS.md | ~400 | ⬜ Todo |
| DESIGN_TOKENS.md | ~300 | ⬜ Todo |
| PATTERNS.md | ~400 | ⬜ Todo |
| **Total** | **~1,100** | **⬜ Todo** |

### Performance
- [ ] Table columns memoized (7 pages)
- [ ] Heavy calculations memoized (3 pages)
- [ ] Large dialogs lazy loaded (4 dialogs)
- [ ] Icon imports optimized (all files)
- [ ] Bundle size reduced measurably

---

## 📸 Testing Strategy

### Functional Testing
- All pages load without errors
- Dark/light mode toggle works everywhere
- Charts display correctly in both modes
- Forms, dialogs, tables all functional
- API calls succeed

### Performance Testing
```bash
# Before optimization
bun run build
ls -lh dist/assets/*.js  # Note sizes

# After optimization
bun run build
ls -lh dist/assets/*.js  # Compare sizes

# Expected: 10-15% reduction
```

### Documentation Testing
- Copy-paste code examples (must work)
- Verify prop interfaces match actual code
- Check all links are valid

---

## 🚀 Implementation Order

**Recommended sequence:**

1. **Week 1 & 2 must be complete**
   - Design tokens available
   - Large components refactored

2. **Start with Task 1 (Charts)**
   - Create chartTheme.ts
   - Update charts one page at a time
   - Test dark mode after each

3. **Task 2 (Theme consolidation)**
   - Simplify ThemeContext
   - Update main.tsx
   - Test theme toggle

4. **Task 3 (Performance) - Can parallelize**
   - Memoize columns (one page at a time)
   - Lazy load dialogs
   - Optimize imports

5. **Task 4 (Documentation) - Can do anytime**
   - Write as you go
   - Or dedicate final session

6. **Task 5 (Cleanup) - Last**
   - Final sweep
   - Update README
   - Submit PR

---

## 📚 Documentation Created

### Implementation Guide
**File:** `docs/DESIGN_SYSTEM_WEEK3_GUIDE.md` (1,477 lines)

**Contents:**
- Prerequisites & setup
- Task-by-task implementation steps
- Code examples (before/after)
- Testing checklist per task
- Performance measurement guide
- Completion checklist

### Documentation Files (Created in Task 4)
- `docs/COMPONENTS.md` - Component library reference
- `docs/DESIGN_TOKENS.md` - Token system guide
- `docs/PATTERNS.md` - Best practices & patterns

---

## 🔍 Verification Commands

```bash
# View issue
gh issue view 265

# Track progress
gh issue comment 265 --body "✅ Task 1 done: Charts integrated"

# Check bundle size before/after
bun run build
ls -lh dist/assets/*.js

# Find remaining inline styles
grep -r "style={{" src/ --include="*.tsx" | wc -l

# Verify TypeScript
bun run typecheck

# Lint check
bun run lint
```

---

## 💡 Success Criteria

### Code Quality
- [ ] All 5 tasks completed
- [ ] TypeScript compiles cleanly
- [ ] Oxlint passes
- [ ] Build succeeds
- [ ] No console errors

### Functionality
- [ ] All features work
- [ ] No regressions
- [ ] Dark/light mode perfect
- [ ] Charts themed correctly
- [ ] Performance improved

### Documentation
- [ ] 3 documentation files created (~1,100 lines)
- [ ] All examples tested and working
- [ ] README updated
- [ ] Clear and comprehensive

### Performance
- [ ] Bundle size reduced 10-15%
- [ ] Lazy loading works
- [ ] No unnecessary re-renders
- [ ] Faster page loads (subjective)

---

## 🔗 Dependencies

**Prerequisites:**
- Issue #263 (Week 1) - Must be completed
- Issue #264 (Week 2) - Must be completed

**Blocks:** None (this is final week)

---

## 📅 Timeline

**Estimated total effort:** 8-10 hours

**Suggested schedule:**
- **Day 1 (3-4 hours):** Tasks 1 & 2 (integration)
- **Day 2 (3-4 hours):** Task 3 (performance)
- **Day 3 (2-3 hours):** Tasks 4 & 5 (documentation & cleanup)

**Can be parallelized:**
- Documentation (Task 4) can be done alongside other tasks
- Performance optimizations can be split between developers

---

## 🎯 Overall Design System Refactor Progress

| Week | Issue | Status | Focus |
|------|-------|--------|-------|
| **Week 1** | #263 | ⬜ Todo | Tokens & Colors |
| **Week 2** | #264 | ⬜ Todo | Component Refactoring |
| **Week 3** | #265 | ⬜ Todo | Integration & Docs |

**Total estimated effort:** 24-29 hours across 3 weeks

**When complete:**
- ✅ Zero hardcoded colors/styles
- ✅ Consistent design language
- ✅ Maintainable component architecture
- ✅ Optimized performance
- ✅ Comprehensive documentation
- ✅ Team-ready & AI-ready codebase

---

## 📞 Support

**Implementation questions:**  
→ Comment on issue #265

**Performance profiling help:**  
→ Use React DevTools Profiler

**Documentation feedback:**  
→ Suggest edits in PR review

**Stuck or blocker:**  
→ Escalate in standup

---

**Created by:** Kiro AI Assistant  
**Command used:** `gh issue create` + `gh api`  
**Repository:** wardix/koperasi-app  
**Related:** Issues #263 (Week 1), #264 (Week 2)
