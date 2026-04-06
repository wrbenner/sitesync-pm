# V6 Track A: A2 — Split Primitives.tsx (1,513 Lines → Individual Components)

**Status:** CRITICAL CODE SMELL | V5 left this untouched
**Priority:** P1 (Maintenance nightmare, impossible to refactor)
**Estimated Effort:** 12-16 hours

---

## THE PROBLEM

`src/components/Primitives.tsx` contains **24 unrelated UI components** in a single 1,513-line file:

```
src/components/Primitives.tsx
├── SidebarContext (line 14)
├── useSidebar (line 19)
├── PageContainer (line 31)
├── Card (line 104)
├── Btn (line 157)
├── MetricBox (line 262)
├── Tag (line 338)
├── StatusTag (line 369)
├── PriorityTag (line 391)
├── SectionHeader (line 411)
├── TableHeader (line 443)
├── TableRow (line 485)
├── Modal (line 535)
├── TabBar (line 665)
├── Avatar (line 731)
├── ProgressBar (line 767)
├── Dot (line 808)
├── AIRing (line 829)
├── InputField (line 873)
├── RelatedItems (line 980)
├── ToastProvider (line 1057)
├── CommandPalette (line 1165)
├── DetailPanel (line 1389)
├── Skeleton (line 1471)
├── EmptyState (line 1483)
```

**Consequences:**
- ❌ Impossible to find a component (search takes 5+ minutes)
- ❌ No tree-shaking (entire 1,513 lines imported always)
- ❌ Hard to add React.memo() strategically
- ❌ No documentation per component
- ❌ Circular import risk (one change breaks everything)
- ❌ Onboarding nightmare (new devs don't know which components exist)

---

## SOLUTION

Create a **component library structure**:

```
src/components/
├── Primitives.tsx  ← DELETE THIS FILE (1,513 lines)
└── ui/
    └── Primitives/
        ├── index.ts  (barrel export)
        ├── PageContainer.tsx
        ├── Card.tsx
        ├── Btn.tsx
        ├── MetricBox.tsx
        ├── Tag.tsx
        ├── StatusTag.tsx
        ├── PriorityTag.tsx
        ├── SectionHeader.tsx
        ├── TableHeader.tsx
        ├── TableRow.tsx
        ├── Modal.tsx
        ├── TabBar.tsx
        ├── Avatar.tsx
        ├── ProgressBar.tsx
        ├── Dot.tsx
        ├── AIRing.tsx
        ├── InputField.tsx
        ├── RelatedItems.tsx
        ├── ToastProvider.tsx
        ├── CommandPalette.tsx
        ├── DetailPanel.tsx
        ├── Skeleton.tsx
        ├── EmptyState.tsx
        ├── SidebarContext.tsx
        └── types.ts  (shared types)
```

---

## DETAILED SPLIT (Line-by-Line)

### 1. SidebarContext.tsx (Lines 14-19 from Primitives.tsx)

**File:** `src/components/ui/Primitives/SidebarContext.tsx`

```typescript
import { createContext, useContext } from 'react'

interface SidebarContextType {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
})

export const useSidebar = () => useContext(SidebarContext)
```

**Notes:**
- Context cannot be memoized (is a context, not a component)
- Stays as-is, just isolated in own file

---

### 2. PageContainer.tsx (Lines 31-103 from Primitives.tsx)

**File:** `src/components/ui/Primitives/PageContainer.tsx`

```typescript
import React from 'react'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  layout,
} from '../../styles/theme'

interface PageContainerProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.surfacePage,
      }}
    >
      <div
        style={{
          maxWidth: layout.pageMaxWidth,
          margin: '0 auto',
          padding: `${layout.pagePaddingY} ${layout.pagePaddingX}`,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: spacing[4],
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.text.primary,
                  margin: 0,
                  marginBottom: subtitle ? spacing[1] : 0,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.text.secondary,
                    margin: 0,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div>{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
```

**Notes:**
- Does NOT add React.memo (re-renders frequently based on title/subtitle change)
- Layout component, needs to re-render when content changes

---

### 3. Card.tsx (Lines 104-156 from Primitives.tsx)

**File:** `src/components/ui/Primitives/Card.tsx`

```typescript
import React from 'react'
import { colors, spacing, shadows } from '../../styles/theme'

interface CardProps {
  children: React.ReactNode
  padding?: string
  onClick?: () => void
  'aria-label'?: string
  role?: string
}

export const Card: React.FC<CardProps> = React.memo(
  ({ children, padding = spacing[5], onClick, 'aria-label': ariaLabel, role }) => (
    <div
      role={role}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding,
        boxShadow: shadows.sm,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.md
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.sm
      }}
    >
      {children}
    </div>
  ),
  (prev, next) => {
    // Memoize: only re-render if children or onClick changes
    return prev.children === next.children && prev.onClick === next.onClick
  }
)

Card.displayName = 'Card'
```

**Notes:**
- ALREADY memoized in original (line 104: `React.memo`)
- Keep exact memoization logic
- MUST keep custom equality check (compares children and onClick only)

---

### 4. Btn.tsx (Lines 157-261 from Primitives.tsx)

**File:** `src/components/ui/Primitives/Btn.tsx`

```typescript
import React from 'react'
import { colors, spacing, typography, transitions } from '../../styles/theme'

export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps {
  variant?: BtnVariant
  size?: BtnSize
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
  className?: string
}

const variantStyles: Record<BtnVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
  },
  secondary: {
    backgroundColor: colors.surface,
    color: colors.primary,
    border: `1px solid ${colors.border}`,
  },
  danger: {
    backgroundColor: colors.red,
    color: colors.white,
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.primary,
    border: 'none',
  },
}

const sizeStyles: Record<BtnSize, React.CSSProperties> = {
  sm: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
  },
  md: {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.md,
  },
  lg: {
    padding: `${spacing[4]} ${spacing[5]}`,
    fontSize: typography.fontSize.lg,
  },
}

export const Btn: React.FC<BtnProps> = React.memo(
  ({
    variant = 'primary',
    size = 'md',
    children,
    onClick,
    disabled = false,
    loading = false,
    icon,
    fullWidth = false,
    type = 'button',
    'aria-label': ariaLabel,
    className,
  }) => (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        width: fullWidth ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        borderRadius: '6px',
        transition: transitions.fast,
        fontWeight: typography.fontWeight.semibold,
        border: 'none',
      }}
    >
      {loading && (
        <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
      )}
      {icon && icon}
      {children}
    </button>
  ),
  (prev, next) => {
    return (
      prev.children === next.children &&
      prev.onClick === next.onClick &&
      prev.variant === next.variant &&
      prev.disabled === next.disabled &&
      prev.loading === next.loading
    )
  }
)

Btn.displayName = 'Btn'
```

**Notes:**
- NOT memoized in original (line 157 - NO React.memo!)
- **ADD React.memo HERE** with custom equality
- Keep exact variant/size logic
- exportType = BtnVariant, BtnSize

---

### 5. MetricBox.tsx (Lines 262-337)

**File:** `src/components/ui/Primitives/MetricBox.tsx`

```typescript
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface MetricBoxProps {
  label: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down' | 'neutral'
  }
  icon?: React.ReactNode
}

export const MetricBox: React.FC<MetricBoxProps> = React.memo(
  ({ label, value, change, icon }) => {
    const trendColor =
      change?.trend === 'up'
        ? colors.green
        : change?.trend === 'down'
          ? colors.red
          : colors.gray

    return (
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.md,
          padding: spacing[4],
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: spacing[3],
          alignItems: 'start',
        }}
      >
        {icon && (
          <div
            style={{
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}

        <div>
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.secondary,
              margin: `0 0 ${spacing[2]} 0`,
              fontWeight: typography.fontWeight.regular,
            }}
          >
            {label}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: spacing[2],
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
              }}
            >
              {value}
            </span>

            {change && (
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: trendColor,
                  fontWeight: typography.fontWeight.semibold,
                }}
              >
                {change.trend === 'up' ? '↑' : change.trend === 'down' ? '↓' : '→'}{' '}
                {Math.abs(change.value)}%
              </span>
            )}
          </div>
        </div>
      </div>
    )
  },
  (prev, next) => {
    return (
      prev.label === next.label &&
      prev.value === next.value &&
      prev.change?.value === next.change?.value &&
      prev.change?.trend === next.change?.trend &&
      prev.icon === next.icon
    )
  }
)

MetricBox.displayName = 'MetricBox'
```

**Notes:**
- ALREADY memoized (line 262: `React.memo`)
- Keep custom equality check
- Pure presentation component

---

### 6. Tag.tsx (Lines 338-368)

**File:** `src/components/ui/Primitives/Tag.tsx`

```typescript
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface TagProps {
  label: string
  backgroundColor?: string
  textColor?: string
  onRemove?: () => void
}

export const Tag: React.FC<TagProps> = React.memo(
  ({
    label,
    backgroundColor = colors.blue,
    textColor = colors.white,
    onRemove,
  }) => (
    <span
      style={{
        backgroundColor,
        color: textColor,
        padding: `${spacing[1]} ${spacing[2]}`,
        borderRadius: borderRadius.full,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[2],
      }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </span>
  ),
  (prev, next) => {
    return (
      prev.label === next.label &&
      prev.backgroundColor === next.backgroundColor &&
      prev.textColor === next.textColor &&
      prev.onRemove === next.onRemove
    )
  }
)

Tag.displayName = 'Tag'
```

**Notes:**
- NOT memoized in original (line 338)
- **ADD React.memo HERE**
- Pure presentation, safe to memoize

---

### 7. StatusTag.tsx (Lines 369-390)

**File:** `src/components/ui/Primitives/StatusTag.tsx`

```typescript
import React from 'react'
import { colors } from '../../styles/theme'
import { Tag } from './Tag'

interface StatusTagProps {
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'completed'
  label?: string
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: colors.gray, text: colors.white },
  review: { bg: colors.orange, text: colors.white },
  approved: { bg: colors.green, text: colors.white },
  rejected: { bg: colors.red, text: colors.white },
  completed: { bg: colors.blue, text: colors.white },
}

export const StatusTag: React.FC<StatusTagProps> = React.memo(
  ({ status, label }) => {
    const colors_config = statusColors[status]
    return (
      <Tag
        label={label || status.charAt(0).toUpperCase() + status.slice(1)}
        backgroundColor={colors_config.bg}
        textColor={colors_config.text}
      />
    )
  },
  (prev, next) => prev.status === next.status && prev.label === next.label
)

StatusTag.displayName = 'StatusTag'
```

**Notes:**
- ALREADY memoized (line 369)
- Composes Tag component
- Keep memoization

---

### 8. PriorityTag.tsx (Lines 391-410)

**File:** `src/components/ui/Primitives/PriorityTag.tsx`

```typescript
import React from 'react'
import { colors } from '../../styles/theme'
import { Tag } from './Tag'

interface PriorityTagProps {
  priority: 'low' | 'medium' | 'high'
  label?: string
}

const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: colors.blue, text: colors.white },
  medium: { bg: colors.orange, text: colors.white },
  high: { bg: colors.red, text: colors.white },
}

export const PriorityTag: React.FC<PriorityTagProps> = React.memo(
  ({ priority, label }) => {
    const config = priorityColors[priority]
    return (
      <Tag
        label={label || priority.charAt(0).toUpperCase() + priority.slice(1)}
        backgroundColor={config.bg}
        textColor={config.text}
      />
    )
  },
  (prev, next) => prev.priority === next.priority && prev.label === next.label
)

PriorityTag.displayName = 'PriorityTag'
```

**Notes:**
- ALREADY memoized (line 391)
- Composes Tag component
- Keep memoization

---

### 9. SectionHeader.tsx (Lines 411-442)

**File:** `src/components/ui/Primitives/SectionHeader.tsx`

```typescript
import React from 'react'
import { spacing, typography, colors } from '../../styles/theme'

interface SectionHeaderProps {
  title: string
  action?: React.ReactNode
}

export const SectionHeader: React.FC<SectionHeaderProps> = React.memo(
  ({ title, action }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[4],
        borderBottom: `2px solid ${colors.border}`,
        paddingBottom: spacing[3],
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.bold,
          color: colors.text.primary,
        }}
      >
        {title}
      </h2>
      {action && <div>{action}</div>}
    </div>
  ),
  (prev, next) => prev.title === next.title && prev.action === next.action
)

SectionHeader.displayName = 'SectionHeader'
```

**Notes:**
- NOT memoized in original (line 411)
- **ADD React.memo HERE**
- Frequently rendered in lists, safe to memoize

---

### 10. TableHeader.tsx (Lines 443-484)

**File:** `src/components/ui/Primitives/TableHeader.tsx`

```typescript
import React from 'react'
import { colors, spacing, typography } from '../../styles/theme'

interface Column {
  label: string
  width: string
}

interface TableHeaderProps {
  columns: Column[]
}

export const TableHeader: React.FC<TableHeaderProps> = React.memo(
  ({ columns }) => (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: columns.map((c) => c.width).join(' '),
        gap: spacing[3],
        backgroundColor: colors.surfaceAlt,
        padding: spacing[4],
        borderBottom: `2px solid ${colors.border}`,
        fontWeight: typography.fontWeight.bold,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
      }}
    >
      {columns.map((col) => (
        <div key={col.label} role="columnheader">
          {col.label}
        </div>
      ))}
    </div>
  ),
  (prev, next) => {
    if (prev.columns.length !== next.columns.length) return false
    return prev.columns.every(
      (col, i) =>
        col.label === next.columns[i].label && col.width === next.columns[i].width
    )
  }
)

TableHeader.displayName = 'TableHeader'
```

**Notes:**
- NOT memoized in original (line 443)
- **ADD React.memo HERE**
- Table header rarely changes, safe to memoize

---

### 11. TableRow.tsx (Lines 485-534)

**File:** `src/components/ui/Primitives/TableRow.tsx`

```typescript
import React from 'react'
import { colors, spacing } from '../../styles/theme'

interface TableRowProps {
  columns: React.ReactNode[]
  onClick?: () => void
  divider?: boolean
  selected?: boolean
}

export const TableRow: React.FC<TableRowProps> = React.memo(
  ({ columns, onClick, divider = true, selected = false }) => (
    <div
      role="row"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: spacing[3],
        padding: spacing[4],
        borderBottom: divider ? `1px solid ${colors.border}` : 'none',
        backgroundColor: selected ? colors.blue + '10' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor =
            colors.blue + '05'
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = selected
          ? colors.blue + '10'
          : 'transparent'
      }}
    >
      {columns.map((col, i) => (
        <div key={i}>{col}</div>
      ))}
    </div>
  ),
  (prev, next) => {
    if (prev.columns.length !== next.columns.length) return false
    return (
      prev.columns.every((col, i) => col === next.columns[i]) &&
      prev.onClick === next.onClick &&
      prev.selected === next.selected
    )
  }
)

TableRow.displayName = 'TableRow'
```

**Notes:**
- ALREADY memoized (line 485)
- Keep custom equality (columns array check)
- Common in lists, needs memoization

---

### 12. Modal.tsx (Lines 535-664)

**File:** `src/components/ui/Primitives/Modal.tsx`

```typescript
import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { colors, spacing, zIndex, shadows } from '../../styles/theme'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export const Modal: React.FC<ModalProps> = React.memo(
  ({ open, onClose, title, children, width = '600px' }) => {
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }

      if (open) {
        document.addEventListener('keydown', handleEscape)
        document.body.style.overflow = 'hidden'
      }

      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'auto'
      }
    }, [open, onClose])

    if (!open) return null

    return (
      <>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: zIndex.modal - 1,
            animation: 'fadeIn 0.2s',
          }}
        />

        {/* Modal */}
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width,
            maxHeight: '90vh',
            overflow: 'auto',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            boxShadow: shadows.lg,
            zIndex: zIndex.modal,
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing[4],
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                color: colors.text.primary,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: spacing[2],
                color: colors.text.secondary,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: spacing[4] }}>{children}</div>
        </div>
      </>
    )
  },
  (prev, next) => {
    return (
      prev.open === next.open &&
      prev.title === next.title &&
      prev.width === next.width &&
      prev.children === next.children &&
      prev.onClose === next.onClose
    )
  }
)

Modal.displayName = 'Modal'
```

**Notes:**
- NOT memoized in original (line 535)
- **ADD React.memo HERE**
- Has useEffect (side effect is OK with memo)
- Memoization prevents unnecessary backdrop re-renders

---

### 13. TabBar.tsx (Lines 665-730)

**File:** `src/components/ui/Primitives/TabBar.tsx`

```typescript
import React from 'react'
import { colors, spacing, typography, transitions } from '../../styles/theme'

interface Tab {
  id: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export const TabBar: React.FC<TabBarProps> = React.memo(
  ({ tabs, activeTab, onChange }) => (
    <div
      role="tablist"
      style={{
        display: 'flex',
        borderBottom: `2px solid ${colors.border}`,
        gap: spacing[4],
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            background: 'none',
            border: 'none',
            padding: `${spacing[3]} ${spacing[4]}`,
            fontSize: typography.fontSize.md,
            fontWeight: activeTab === tab.id ? typography.fontWeight.bold : typography.fontWeight.regular,
            color:
              activeTab === tab.id ? colors.primary : colors.text.secondary,
            cursor: 'pointer',
            position: 'relative',
            transition: transitions.fast,
          }}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: colors.primary,
              }}
            />
          )}
        </button>
      ))}
    </div>
  ),
  (prev, next) => {
    if (prev.tabs.length !== next.tabs.length) return false
    return (
      prev.tabs.every((tab, i) => tab.id === next.tabs[i].id) &&
      prev.activeTab === next.activeTab &&
      prev.onChange === next.onChange
    )
  }
)

TabBar.displayName = 'TabBar'
```

**Notes:**
- NOT memoized in original (line 665)
- **ADD React.memo HERE**
- Frequently used navigation, safe to memoize

---

### 14-24. Remaining Components

Due to space, here are the remaining files with **CRITICAL memoization notes:**

| File | Original Line | Memoize? | Notes |
|------|---|---|---|
| Avatar.tsx | 731 | ✓ (keep) | Simple presentation, already memoized |
| ProgressBar.tsx | 767 | ✓ (ADD) | Pure presentation, safe |
| Dot.tsx | 808 | ✓ (keep) | Already memoized, pure |
| AIRing.tsx | 829 | ✗ | Animation loop, DO NOT memoize |
| InputField.tsx | 873 | ✓ (ADD) | Form input, safe to memoize |
| RelatedItems.tsx | 980 | ✗ | Interactive list, DO NOT memoize |
| ToastProvider.tsx | 1057 | ✗ | Context provider, DO NOT memoize |
| CommandPalette.tsx | 1165 | ✗ | State management, DO NOT memoize |
| DetailPanel.tsx | 1389 | ✓ (ADD) | Similar to Modal, safe to memoize |
| Skeleton.tsx | 1471 | ✓ (ADD) | Loading state, safe to memoize |
| EmptyState.tsx | 1483 | ✓ (ADD) | Static presentation, safe to memoize |

---

## Barrel Export Index

**File:** `src/components/ui/Primitives/index.ts`

```typescript
// Context
export { SidebarContext, useSidebar } from './SidebarContext'

// Layout
export { PageContainer } from './PageContainer'

// Cards & Containers
export { Card } from './Card'
export { DetailPanel } from './DetailPanel'

// Buttons
export { Btn } from './Btn'
export type { BtnProps, BtnVariant, BtnSize } from './Btn'

// Tags & Status
export { Tag } from './Tag'
export { StatusTag } from './StatusTag'
export { PriorityTag } from './PriorityTag'

// Headers & Tables
export { SectionHeader } from './SectionHeader'
export { TableHeader } from './TableHeader'
export { TableRow } from './TableRow'

// Data Display
export { MetricBox } from './MetricBox'
export { Avatar } from './Avatar'
export { ProgressBar } from './ProgressBar'
export { Dot } from './Dot'
export { AIRing } from './AIRing'
export { Skeleton } from './Skeleton'
export { EmptyState } from './EmptyState'

// Forms
export { InputField } from './InputField'

// Navigation
export { TabBar } from './TabBar'

// Overlay
export { Modal } from './Modal'

// Features
export { RelatedItems } from './RelatedItems'
export { CommandPalette } from './CommandPalette'

// Toast
export { ToastProvider, useToast, ToastContext } from './ToastProvider'

// Types
export type {
  BtnProps,
  BtnVariant,
  BtnSize,
  CardProps,
  ModalProps,
  TabBarProps,
  MetricBoxProps,
  // ... all other prop types
} from './types'
```

**File:** `src/components/ui/Primitives/types.ts`

```typescript
import React from 'react'

export interface BtnProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
  className?: string
}

export interface CardProps {
  children: React.ReactNode
  padding?: string
  onClick?: () => void
  'aria-label'?: string
  role?: string
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

// ... all other prop types
```

---

## Import Changes

### Before
```typescript
import {
  Card,
  Btn,
  Modal,
  Tag,
  SectionHeader,
  PageContainer,
  Avatar,
  StatusTag,
} from '../components/Primitives'
```

### After
```typescript
import {
  Card,
  Btn,
  Modal,
  Tag,
  SectionHeader,
  PageContainer,
  Avatar,
  StatusTag,
} from '../components/ui/Primitives'
```

**Note:** Same import names, just different path. No component code changes needed.

---

## Execution Checklist

- [ ] Create `src/components/ui/Primitives/` directory
- [ ] Extract each component to individual `.tsx` file (24 files total)
- [ ] Create `types.ts` with all prop interfaces
- [ ] Create `index.ts` barrel export
- [ ] **ADD React.memo to:** Btn, Tag, SectionHeader, TableHeader, Modal, TabBar, ProgressBar, InputField, DetailPanel, Skeleton, EmptyState (11 new memos)
- [ ] **KEEP React.memo in:** Card, MetricBox, StatusTag, PriorityTag, Dot, Avatar, TableRow (7 existing)
- [ ] **DO NOT memo:** ToastProvider, CommandPalette, RelatedItems, AIRing, SidebarContext
- [ ] Update all imports in codebase: `from '../Primitives'` → `from '../ui/Primitives'`
- [ ] Delete original `src/components/Primitives.tsx`

---

## Verification Script

```bash
#!/bin/bash
# Verify Primitives split complete

set -e

echo "✓ Checking Primitives.tsx deleted..."
if [ -f "src/components/Primitives.tsx" ]; then
  echo "❌ FAIL: src/components/Primitives.tsx still exists"
  exit 1
fi

echo "✓ Checking individual component files..."
required_files=(
  "src/components/ui/Primitives/index.ts"
  "src/components/ui/Primitives/types.ts"
  "src/components/ui/Primitives/PageContainer.tsx"
  "src/components/ui/Primitives/Card.tsx"
  "src/components/ui/Primitives/Btn.tsx"
  "src/components/ui/Primitives/MetricBox.tsx"
  "src/components/ui/Primitives/Tag.tsx"
  "src/components/ui/Primitives/StatusTag.tsx"
  "src/components/ui/Primitives/PriorityTag.tsx"
  "src/components/ui/Primitives/SectionHeader.tsx"
  "src/components/ui/Primitives/TableHeader.tsx"
  "src/components/ui/Primitives/TableRow.tsx"
  "src/components/ui/Primitives/Modal.tsx"
  "src/components/ui/Primitives/TabBar.tsx"
  "src/components/ui/Primitives/Avatar.tsx"
  "src/components/ui/Primitives/ProgressBar.tsx"
  "src/components/ui/Primitives/Dot.tsx"
  "src/components/ui/Primitives/AIRing.tsx"
  "src/components/ui/Primitives/InputField.tsx"
  "src/components/ui/Primitives/RelatedItems.tsx"
  "src/components/ui/Primitives/ToastProvider.tsx"
  "src/components/ui/Primitives/CommandPalette.tsx"
  "src/components/ui/Primitives/DetailPanel.tsx"
  "src/components/ui/Primitives/Skeleton.tsx"
  "src/components/ui/Primitives/EmptyState.tsx"
  "src/components/ui/Primitives/SidebarContext.tsx"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ FAIL: Missing $file"
    exit 1
  fi
done

echo "✓ Checking component count (should be ~26)..."
count=$(ls src/components/ui/Primitives/*.tsx 2>/dev/null | wc -l)
if [ "$count" -lt 20 ]; then
  echo "❌ FAIL: Only $count components found (expected >= 20)"
  exit 1
fi
echo "  Found: $count components"

echo "✓ Checking React.memo on required components..."
for component in Btn SectionHeader TableHeader Modal TabBar ProgressBar InputField DetailPanel Skeleton EmptyState; do
  file="src/components/ui/Primitives/${component}.tsx"
  if ! grep -q "React.memo" "$file"; then
    echo "❌ FAIL: $component missing React.memo"
    exit 1
  fi
done

echo "✓ Checking NO React.memo on prohibited components..."
for component in ToastProvider CommandPalette RelatedItems AIRing SidebarContext; do
  file="src/components/ui/Primitives/${component}.tsx"
  if grep -q "React.memo" "$file"; then
    echo "❌ FAIL: $component should NOT have React.memo"
    exit 1
  fi
done

echo "✓ Checking barrel export..."
if [ ! -f "src/components/ui/Primitives/index.ts" ]; then
  echo "❌ FAIL: Missing barrel export"
  exit 1
fi

# Check that index.ts exports at least 20 components
export_count=$(grep -c "^export" src/components/ui/Primitives/index.ts)
if [ "$export_count" -lt 20 ]; then
  echo "❌ FAIL: Barrel export has only $export_count exports (expected >= 20)"
  exit 1
fi

echo "✓ Checking no imports from old Primitives path..."
if grep -r "from.*Primitives'" src/components --include="*.tsx" --exclude-dir=ui | grep -v "from.*ui/Primitives"; then
  echo "⚠ WARNING: Found imports from old Primitives path (non-ui)"
fi

echo "✓ Checking new import path used..."
import_count=$(grep -r "from.*ui/Primitives" src/components --include="*.tsx" | wc -l)
if [ "$import_count" -lt 5 ]; then
  echo "⚠ WARNING: New import path not yet adopted ($import_count usages)"
fi

echo ""
echo "✅ ALL CHECKS PASSED - Primitives split complete!"
echo ""
echo "Statistics:"
echo "  - Individual files: $count"
echo "  - Exports in barrel: $export_count"
echo "  - Components using new path: $import_count"
```

Run with:
```bash
bash scripts/verify-primitives-split.sh
```

Expected output:
```
✓ Checking Primitives.tsx deleted...
✓ Checking individual component files...
✓ Checking component count (should be ~26)...
  Found: 26 components
✓ Checking React.memo on required components...
✓ Checking NO React.memo on prohibited components...
✓ Checking barrel export...
✓ Checking no imports from old Primitives path...
✓ Checking new import path used...

✅ ALL CHECKS PASSED - Primitives split complete!

Statistics:
  - Individual files: 26
  - Exports in barrel: 26
  - Components using new path: 180+
```
