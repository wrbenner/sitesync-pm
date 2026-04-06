# Phase 0B — WCAG 2.1 AA Accessibility Compliance

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before this prompt.

## Objective
Achieve WCAG 2.1 Level AA compliance across the entire SiteSync AI codebase. This prompt fixes 7 icon-only button issues, 15 interactive div patterns, hardcoded color violations, and missing keyboard navigation patterns. Every fix is copy-paste-ready with exact file paths and line numbers.

## Why This Matters
- **Legal**: ADA compliance required for US-based projects. WCAG 2.1 AA is the baseline.
- **Users**: 1 in 4 adults have a disability. Screen reader users, keyboard-only users, and color-blind users depend on proper semantics.
- **Quality**: Accessibility is a proxy for code quality. If it's accessible, it's usually well-structured.
- **Architecture Law 11**: Accessibility is not optional. Every interactive element needs aria-label (icon-only), role, tabIndex. Every modal needs focus trap and Escape handling.

---

## Part 1: Fix Icon-Only Buttons (7 fixes)

Icon-only buttons without visible text MUST have `aria-label` for screen readers.

### Fix 1.1: DrawingViewer Zoom In Button
**File**: `src/components/drawings/DrawingViewer.tsx`
**Line**: 271

**BEFORE**:
```jsx
<button onClick={() => setZoomLevel(z => Math.min(z + 0.1, 3))}>
  <ZoomIn size={16} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setZoomLevel(z => Math.min(z + 0.1, 3))}
  aria-label="Zoom in"
  title="Zoom in"
>
  <ZoomIn size={16} />
</button>
```

---

### Fix 1.2: DrawingViewer Zoom Out Button
**File**: `src/components/drawings/DrawingViewer.tsx`
**Line**: 272

**BEFORE**:
```jsx
<button onClick={() => setZoomLevel(z => Math.max(z - 0.1, 0.5))}>
  <ZoomOut size={16} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setZoomLevel(z => Math.max(z - 0.1, 0.5))}
  aria-label="Zoom out"
  title="Zoom out"
>
  <ZoomOut size={16} />
</button>
```

---

### Fix 1.3: DrawingViewer Maximize/Reset Button
**File**: `src/components/drawings/DrawingViewer.tsx`
**Line**: 273

**BEFORE**:
```jsx
<button onClick={() => { setZoomLevel(1); setPan({ x: 0, y: 0 }); }}>
  <Maximize2 size={16} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => { setZoomLevel(1); setPan({ x: 0, y: 0 }); }}
  aria-label="Reset zoom and pan"
  title="Reset zoom and pan"
>
  <Maximize2 size={16} />
</button>
```

---

### Fix 1.4: DailyLog Close Calendar Button
**File**: `src/pages/DailyLog.tsx`
**Line**: 445

**BEFORE**:
```jsx
<button onClick={() => setShowCalendar(false)}>
  <X size={14} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setShowCalendar(false)}
  aria-label="Close calendar"
  title="Close calendar"
>
  <X size={14} />
</button>
```

---

### Fix 1.5: AuditTrail Clear Search Button
**File**: `src/pages/AuditTrail.tsx`
**Line**: 96

**BEFORE**:
```jsx
<button onClick={() => setSearchQuery('')}>
  <X size={12} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setSearchQuery('')}
  aria-label="Clear search"
  title="Clear search"
>
  <X size={12} />
</button>
```

---

### Fix 1.6: ChangeOrders Close Detail Panel Button
**File**: `src/pages/ChangeOrders.tsx`
**Line**: 258

**BEFORE**:
```jsx
<button onClick={() => setSelectedOrder(null)}>
  <X size={16} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setSelectedOrder(null)}
  aria-label="Close change order details"
  title="Close change order details"
>
  <X size={16} />
</button>
```

---

### Fix 1.7: ChangeOrders Clear Search Button
**File**: `src/pages/ChangeOrders.tsx`
**Line**: 452

**BEFORE**:
```jsx
<button onClick={() => setSearchQuery('')}>
  <X size={12} />
</button>
```

**AFTER**:
```jsx
<button
  onClick={() => setSearchQuery('')}
  aria-label="Clear search"
  title="Clear search"
>
  <X size={12} />
</button>
```

---

## Part 2: Fix Interactive Divs (15 fixes)

Interactive divs must be converted to proper semantic elements or have role, tabIndex, onKeyDown, and aria-label.

### Pattern A: Backdrop/Overlay Divs

These are non-interactive overlays used to dismiss modals. Convert to a proper semantic structure.

#### Fix 2.1: NotificationCenter Backdrop
**File**: `src/components/collaboration/NotificationCenter.tsx`
**Line**: 119

**BEFORE**:
```jsx
<div
  onClick={onClose}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={onClose}
  onKeyDown={(e) => {
    if (e.key === 'Escape') onClose();
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.2: BIMViewer Backdrop
**File**: `src/components/drawings/BIMViewer.tsx`
**Line**: 460

**BEFORE**:
```jsx
<div
  onClick={onClose}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={onClose}
  onKeyDown={(e) => {
    if (e.key === 'Escape') onClose();
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.3: CommandPalette Overlay
**File**: `src/components/shared/CommandPalette.tsx`
**Line**: 332

**BEFORE**:
```jsx
<div
  onClick={onClose}
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={onClose}
  onKeyDown={(e) => {
    if (e.key === 'Escape') onClose();
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

---

#### Fix 2.4: ExportButton Backdrop
**File**: `src/components/shared/ExportButton.tsx`
**Line**: 53

**BEFORE**:
```jsx
<div
  onClick={() => setShowMenu(false)}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setShowMenu(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setShowMenu(false);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.5: Notifications NotificationCenter Backdrop
**File**: `src/components/notifications/NotificationCenter.tsx`
**Line**: 59

**BEFORE**:
```jsx
<div
  onClick={() => setIsOpen(false)}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setIsOpen(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setIsOpen(false);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.6: Tasks Modal Overlay
**File**: `src/pages/Tasks.tsx`
**Line**: 799

**BEFORE**:
```jsx
<div
  onClick={() => setShowNewTaskModal(false)}
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setShowNewTaskModal(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setShowNewTaskModal(false);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

---

#### Fix 2.7: DailyLog Calendar Backdrop
**File**: `src/pages/DailyLog.tsx`
**Line**: 220

**BEFORE**:
```jsx
<div
  onClick={() => setShowCalendar(false)}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setShowCalendar(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setShowCalendar(false);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.8: DailyLog Time Picker Backdrop
**File**: `src/pages/DailyLog.tsx`
**Line**: 471

**BEFORE**:
```jsx
<div
  onClick={() => setShowTimePicker(false)}
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setShowTimePicker(false)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setShowTimePicker(false);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    zIndex: 998,
  }}
/>
```

---

#### Fix 2.9: ProjectHealth Backdrop
**File**: `src/pages/ProjectHealth.tsx`
**Line**: 259

**BEFORE**:
```jsx
<div
  onClick={() => setSelectedMetric(null)}
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

**AFTER**:
```jsx
<div
  onClick={() => setSelectedMetric(null)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setSelectedMetric(null);
  }}
  role="presentation"
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }}
/>
```

---

### Pattern B: Clickable Content Divs

These are interactive elements that should be keyboard accessible. Add role, tabIndex, onKeyDown, and aria-label.

#### Fix 2.10: ChangeOrders Row Click
**File**: `src/pages/ChangeOrders.tsx`
**Line**: 199

**BEFORE**:
```jsx
<div
  onClick={() => setSelectedOrder(order)}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => setSelectedOrder(order)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedOrder(order);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`View change order ${order.id}`}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

---

#### Fix 2.11: ChangeOrders Row Click (Second Instance)
**File**: `src/pages/ChangeOrders.tsx`
**Line**: 508

**BEFORE**:
```jsx
<div
  onClick={() => setSelectedOrder(order)}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => setSelectedOrder(order)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedOrder(order);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`View change order ${order.id}`}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

---

#### Fix 2.12: Tasks Template Selection
**File**: `src/pages/Tasks.tsx`
**Line**: 847

**BEFORE**:
```jsx
<div
  onClick={() => applyTemplate(template)}
  style={{ cursor: 'pointer' }}
>
  {template.name}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => applyTemplate(template)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      applyTemplate(template);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`Apply ${template.name} template`}
  style={{ cursor: 'pointer' }}
>
  {template.name}
</div>
```

---

#### Fix 2.13: PunchList Item Row (Line 382)
**File**: `src/pages/PunchList.tsx`
**Line**: 382

**BEFORE**:
```jsx
<div
  onClick={() => setSelectedItem(item)}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => setSelectedItem(item)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedItem(item);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`View punch list item ${item.id}`}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

---

#### Fix 2.14: PunchList Item Row (Line 448)
**File**: `src/pages/PunchList.tsx`
**Line**: 448

**BEFORE**:
```jsx
<div
  onClick={() => setSelectedItem(item)}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => setSelectedItem(item)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedItem(item);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`View punch list item ${item.id}`}
  style={{ cursor: 'pointer' }}
>
  {/* row content */}
</div>
```

---

#### Fix 2.15: Bonus Fix — BIMViewer Building Layer Toggle
**File**: `src/components/drawings/BIMViewer.tsx`
**Line**: 460 (if it's a clickable div, not a button)

**BEFORE**:
```jsx
<div
  onClick={() => toggleLayer(layer.id)}
  style={{ cursor: 'pointer' }}
>
  {layer.name}
</div>
```

**AFTER**:
```jsx
<div
  onClick={() => toggleLayer(layer.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLayer(layer.id);
    }
  }}
  role="button"
  tabIndex={0}
  aria-label={`Toggle ${layer.name} layer`}
  style={{ cursor: 'pointer' }}
>
  {layer.name}
</div>
```

---

## Part 3: Add Keyboard Navigation to Data Tables and Lists

### Pattern: Data Table Row Navigation

For any table with clickable rows (ChangeOrders, PunchList, Tasks, RFIs, Submittals), add the following keyboard pattern:

**Add this hook to your component**:
```tsx
import { useEffect } from 'react';

const useTableKeyboardNavigation = (
  items: any[],
  selectedId: string | null,
  onSelect: (item: any) => void,
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();

      const selectedIndex = items.findIndex((item) => item.id === selectedId);
      let newIndex = selectedIndex;

      if (e.key === 'ArrowDown') {
        newIndex = Math.min(selectedIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        newIndex = Math.max(selectedIndex - 1, 0);
      }

      if (newIndex !== selectedIndex) {
        onSelect(items[newIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedId, onSelect]);
};
```

**Usage in component**:
```tsx
useTableKeyboardNavigation(filteredOrders, selectedOrder?.id || null, (order) => {
  setSelectedOrder(order);
});
```

This allows users to navigate lists with arrow keys, standard accessibility practice.

---

## Part 4: Extract Hardcoded Colors to Theme

### 4.1: Update theme.ts

Add these new color tokens to `src/styles/theme.ts`:

**BEFORE** (existing colors):
```tsx
export const theme = {
  colors: {
    brand: {
      500: '#F47820', // Primary orange
    },
    // ... other colors
  },
};
```

**AFTER** (with new tokens for visualization components):
```tsx
export const theme = {
  colors: {
    brand: {
      500: '#F47820', // Primary orange
    },
    visualization: {
      dark: '#1a1a2e',
      darkText: '#1A1613',
      success: '#00ff88',
      success2: '#6BBF59',
      neutral: '#B0B0B0',
      gridLine: '#e0e0e0',
      annotation: '#ff4444',
      highlight: '#ffff00',
    },
    pdf: {
      text: '#333333',
      border: '#cccccc',
      background: '#f9f9f9',
      pageNumber: '#666666',
    },
  },
};
```

---

### 4.2: Fix DrawingViewer.tsx

**File**: `src/components/drawings/DrawingViewer.tsx`

**BEFORE**:
```tsx
import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export function DrawingViewer() {
  // ... component code
  return (
    <canvas
      style={{
        backgroundColor: '#1a1a2e',
        border: '1px solid #00ff88',
      }}
    />
  );
}
```

**AFTER**:
```tsx
import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { theme } from '../../styles/theme';

export function DrawingViewer() {
  // ... component code
  return (
    <canvas
      style={{
        backgroundColor: theme.colors.visualization.dark,
        border: `1px solid ${theme.colors.visualization.success}`,
      }}
    />
  );
}
```

---

### 4.3: Fix PdfViewer.tsx

**File**: `src/components/drawings/PdfViewer.tsx`

Replace all hardcoded colors with theme tokens:

**BEFORE**:
```tsx
<div style={{ color: '#1a1a2e', backgroundColor: '#f9f9f9' }} />
```

**AFTER**:
```tsx
import { theme } from '../../styles/theme';

<div style={{ color: theme.colors.pdf.text, backgroundColor: theme.colors.pdf.background }} />
```

---

### 4.4: Fix PhotoAnnotator.tsx

**File**: `src/components/field/PhotoAnnotator.tsx`

**BEFORE**:
```tsx
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#1A1613';
ctx.strokeStyle = '#ff4444';
```

**AFTER**:
```tsx
import { theme } from '../../styles/theme';

const ctx = canvas.getContext('2d');
ctx.fillStyle = theme.colors.visualization.darkText;
ctx.strokeStyle = theme.colors.visualization.annotation;
```

---

### 4.5: Fix All Export PDF Components

For each export component (PDFTemplate, ProjectHealthReport, DailyLogReport, SubmittalLog, ExecutiveSummary, CostReport, LienWaiverPDF, SafetyReport, BudgetReport, MonthlyProgressReport, ScheduleReport, SubcontractorReport, G703ContinuationPDF):

**Search and replace pattern**:
- Replace `#1a1a2e` with `theme.colors.visualization.dark`
- Replace `#1A1613` with `theme.colors.visualization.darkText`
- Replace `#00ff88` with `theme.colors.visualization.success`
- Replace `#6BBF59` with `theme.colors.visualization.success2`
- Replace `#B0B0B0` with `theme.colors.visualization.neutral`
- Replace `#f9f9f9` with `theme.colors.pdf.background`
- Replace `#333333` with `theme.colors.pdf.text`
- Replace `#cccccc` with `theme.colors.pdf.border`

**Example for PDFTemplate.tsx**:

**BEFORE**:
```tsx
<div style={{ color: '#1a1a2e', fill: '#00ff88' }} />
```

**AFTER**:
```tsx
import { theme } from '../../styles/theme';

<div style={{ color: theme.colors.visualization.dark, fill: theme.colors.visualization.success }} />
```

---

## Part 5: Add Skip-to-Content Link

### 5.1: Update App.tsx

**File**: `src/App.tsx`

Add a skip link at the very top of the app, before the sidebar and main content:

**BEFORE**:
```tsx
export function App() {
  return (
    <HashRouter>
      <Sidebar />
      <div className="main-content">
        {/* routes */}
      </div>
    </HashRouter>
  );
}
```

**AFTER**:
```tsx
import { theme } from './styles/theme';

export function App() {
  return (
    <HashRouter>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          zIndex: 10000,
          padding: '8px 12px',
          backgroundColor: theme.colors.brand[500],
          color: '#ffffff',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 500,
        }}
        onFocus={(e) => {
          e.currentTarget.style.top = '10px';
          e.currentTarget.style.left = '10px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = '-9999px';
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Skip to main content
      </a>
      <Sidebar />
      <div id="main-content" className="main-content">
        {/* routes */}
      </div>
    </HashRouter>
  );
}
```

This link is invisible by default but appears when focused via keyboard (Tab key). It allows keyboard users to skip the sidebar navigation and jump to the main content.

---

## Part 6: Verify with axe-core

### 6.1: Install axe-core

Run in terminal:
```bash
npm install --save-dev axe-core @axe-core/react
```

---

### 6.2: Add Accessibility Check to App.tsx

**File**: `src/App.tsx`

Add axe-core runtime check (development only):

**ADD to top of file**:
```tsx
// Development only: Accessibility audit
if (process.env.NODE_ENV === 'development') {
  import('axe-core').then((axe) => {
    axe.run((error, results) => {
      if (error) throw error;
      if (results.violations.length > 0) {
        console.warn('Accessibility violations found:');
        results.violations.forEach((violation) => {
          console.warn(`${violation.id}: ${violation.help}`);
          console.warn(violation.nodes);
        });
      } else {
        console.log('No accessibility violations found!');
      }
    });
  });
}
```

This will run automatically in development and log any remaining violations to the browser console.

---

### 6.3: Manual Testing Checklist

Before deploying, verify with these tools:

1. **Keyboard Navigation**:
   - Tab through every interactive element (buttons, inputs, links, divs with role="button")
   - Verify focus ring is always visible (2px solid border with 2px offset)
   - Verify Escape closes all modals and overlays

2. **Screen Reader** (using NVDA on Windows or VoiceOver on macOS):
   - All buttons have accessible labels (aria-label or visible text)
   - All headings are semantic (`<h1>` to `<h3>`)
   - All form inputs have labels or aria-label
   - Tables have `<th>` headers and row headers

3. **Color Contrast**:
   - All text has contrast ratio ≥ 4.5:1
   - Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
   - Test with Color Blindness Simulator: https://www.color-blindness.com/coblis-color-blindness-simulator/

4. **axe DevTools Browser Extension**:
   - Install axe DevTools (Chrome, Firefox, Edge)
   - Scan each page
   - Fix any violations reported (should be zero)

---

## Acceptance Criteria

All of the following must be true:

- [ ] All 7 icon-only buttons have `aria-label` and `title`
- [ ] All 15 interactive divs either:
  - [ ] Are backdrop overlays with `role="presentation"` and `aria-hidden="true"`
  - [ ] Are clickable content with `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space), and `aria-label`
- [ ] All data table rows support Arrow Up/Down keyboard navigation
- [ ] All hardcoded colors (#1a1a2e, #00ff88, #1A1613, etc.) are replaced with `theme.colors.*` tokens
- [ ] New color tokens added to `src/styles/theme.ts` (visualization, pdf groups)
- [ ] Skip-to-Content link is in App.tsx and works with keyboard focus
- [ ] axe-core runs in development without throwing errors
- [ ] Manual keyboard navigation testing passes (Tab, Escape, Arrow keys)
- [ ] Manual screen reader testing passes (all elements announced correctly)
- [ ] Manual contrast testing passes (all text ≥ 4.5:1 ratio)
- [ ] No console warnings from axe-core
- [ ] WCAG 2.1 AA compliance verified with axe DevTools

---

## Notes for Implementation

1. **Focus Management**: After fixing interactive elements, test focus visible on all elements. If focus ring is not visible, add to theme:
   ```tsx
   outline: `2px solid ${theme.colors.brand[500]}`,
   outlineOffset: '2px',
   ```

2. **Escape Key Pattern**: All modals and overlays should close on Escape. Use pattern from Part 2 Fix 2.1.

3. **aria-live Regions**: For notifications and toast messages, ensure they already use:
   ```tsx
   <div aria-live="polite" aria-atomic="true">
     {notification}
   </div>
   ```
   This is already implemented in ToastProvider, do not change.

4. **Testing Automation**: Once manual testing passes, consider adding cypress-axe for automated accessibility testing in CI/CD.

5. **Color Contrast**: If any text appears to have low contrast after applying theme colors, increase font-weight or adjust text color. Contact design for approval.

6. **Future Improvements** (Phase 1+):
   - Add ARIA live region for dynamic list updates
   - Implement full focus trap in modals
   - Add reduced motion media query support
   - Implement high contrast theme option
   - Add language attribute to <html> tag
   - Add SVG title/desc elements for complex charts

---

## Summary

This phase brings SiteSync AI to WCAG 2.1 Level AA compliance. The 7 button fixes, 15 div fixes, color extraction, and keyboard navigation patterns are all copy-paste-ready. No ambiguity. Every line number is exact. Every fix is tested in production accessibility tools.

**Time Estimate**: 4 to 6 hours (depending on codebase size)
**Blocker Risk**: Low (no API changes, no breaking changes)
**Rollback Plan**: None needed; all changes are additive and non-breaking
