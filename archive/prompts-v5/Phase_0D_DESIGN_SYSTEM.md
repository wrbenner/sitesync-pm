# Phase 0D: Design System Refactoring and Performance Optimization

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

## Audit Status

### Critical Issues Found

**Primitives.tsx Size and Memoization**
- **File**: `src/components/Primitives.tsx`
- **Size**: 1,513 lines (monolithic)
- **16 Components Missing React.memo**:
  1. Btn (line ~180)
  2. PageContainer (line ~240)
  3. Modal (line ~320)
  4. InputField (line ~420)
  5. TableHeader (line ~540)
  6. SectionHeader (line ~600)
  7. Tag (line ~680)
  8. TabBar (line ~750)
  9. ProgressBar (line ~830)
  10. DetailPanel (line ~920)
  11. Skeleton (line ~1020)
  12. EmptyState (line ~1100)
  13. Dot (line ~1180)
  14. AIRing (line ~1220)
  15. RelatedItems (line ~1300)
  16. CommandPalette (line ~1380)

- **7 Components Already Have React.memo**:
  1. Card (wrapped)
  2. MetricBox (wrapped)
  3. StatusTag (wrapped)
  4. PriorityTag (wrapped)
  5. TableRow (wrapped)
  6. Avatar (wrapped)
  7. (+ 1 more)

- **Missing useMemo/useCallback**:
  - Btn component: onClick handlers need useCallback
  - PageContainer: derived column widths need useMemo
  - Modal: onClose and onSuccess need useCallback
  - InputField: onChange handler needs useCallback
  - Multiple components: inline object/array literals need memoization

---

## Architecture Law 7: ZERO RAW VALUES

**Current Violations in Primitives.tsx**:
- All color values must come from `colors` object in theme.ts
- All spacing values must come from `spacing` object in theme.ts
- All typography values must come from `typography` object in theme.ts
- No hardcoded px values, rem values, or hex colors in component code
- All border styles reference `borderRadius` from theme.ts
- All transitions reference `transitions` from theme.ts

**Status**: Mostly compliant, but verify no inline style hardcoding.

---

## Architecture Law 13: PERFORMANCE BUDGETS

**Requirements**:
- Every component receiving stable props MUST be wrapped with React.memo
- Every derived value (computed from props/state) MUST use useMemo
- Every event handler (onClick, onChange, etc.) MUST use useCallback
- Benchmark: LCP < 2.5s, FID < 100ms, CLS < 0.1

---

## Implementation Task 1: Split Primitives.tsx into Component Files

**Strategy**:
1. Create `src/components/ui/` directory
2. Move each component into its own file with inline styles
3. Create `src/components/ui/index.ts` barrel export for backward compatibility
4. Add React.memo and performance hooks to each component
5. Update Primitives.tsx to re-export from individual files (or deprecate entirely)

**File Structure After Refactoring**:

```
src/components/
  ui/
    Button.tsx          # Btn component
    PageContainer.tsx   # PageContainer component
    Modal.tsx           # Modal component
    InputField.tsx      # InputField component
    TableHeader.tsx     # TableHeader component
    SectionHeader.tsx   # SectionHeader component
    Tag.tsx             # Tag component
    TabBar.tsx          # TabBar component
    ProgressBar.tsx     # ProgressBar component
    DetailPanel.tsx     # DetailPanel component
    Skeleton.tsx        # Skeleton component
    EmptyState.tsx      # EmptyState component
    Dot.tsx             # Dot component
    AIRing.tsx          # AIRing component
    RelatedItems.tsx    # RelatedItems component
    CommandPalette.tsx  # CommandPalette component
    Card.tsx            # Card component (already has memo)
    MetricBox.tsx       # MetricBox component (already has memo)
    StatusTag.tsx       # StatusTag component (already has memo)
    PriorityTag.tsx     # PriorityTag component (already has memo)
    TableRow.tsx        # TableRow component (already has memo)
    Avatar.tsx          # Avatar component (already has memo)
    Label.tsx           # Label component
    Checkbox.tsx        # Checkbox component
    useToast.tsx        # useToast hook
    index.ts            # Barrel export (maintains backward compatibility)
  Primitives.tsx       # DEPRECATED: re-export from ui/index.ts for migration period
```

---

## Detailed Component Implementations

### 1. Button.tsx

**File Path**: `src/components/ui/Button.tsx` (NEW FILE)

```typescript
import React, { useMemo, useCallback } from 'react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

const getBtnStyles = (
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
  disabled?: boolean,
  isLoading?: boolean,
) => {
  const baseStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing['2'],
    border: 'none' as const,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer' as const,
    transition: `all ${transitions.instant}`,
    opacity: disabled || isLoading ? 0.6 : 1,
  }

  const sizePadding = {
    sm: `${spacing['1.5']} ${spacing['3']}`,
    md: `${spacing['2']} ${spacing['4']}`,
    lg: `${spacing['3']} ${spacing['6']}`,
  }

  const variantStyles = {
    primary: {
      backgroundColor: colors.primaryOrange,
      color: colors.white,
      '&:hover': !disabled && !isLoading ? { opacity: 0.9 } : {},
    },
    secondary: {
      backgroundColor: colors.surfaceRaised,
      color: colors.textPrimary,
      border: `1px solid ${colors.borderDefault}`,
      '&:hover': !disabled && !isLoading ? { backgroundColor: colors.surfaceInset } : {},
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.textPrimary,
      '&:hover': !disabled && !isLoading ? { backgroundColor: colors.surfaceInset } : {},
    },
    danger: {
      backgroundColor: colors.statusCritical,
      color: colors.white,
      '&:hover': !disabled && !isLoading ? { opacity: 0.9 } : {},
    },
  }

  return {
    ...baseStyle,
    padding: sizePadding[size],
    ...variantStyles[variant],
  }
}

export const Btn = React.memo<BtnProps>(({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  children,
  onClick,
  ...rest
}) => {
  const btnStyle = useMemo(
    () => getBtnStyles(variant, size, disabled, isLoading),
    [variant, size, disabled, isLoading],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isLoading && !disabled && onClick) {
        onClick(e)
      }
    },
    [onClick, isLoading, disabled],
  )

  return (
    <button
      {...rest}
      style={btnStyle}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {isLoading && (
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `2px solid currentColor`,
            borderTopColor: 'transparent',
            animation: 'spin 600ms linear infinite',
          }}
        />
      )}
      {children}
    </button>
  )
})
Btn.displayName = 'Btn'
```

### 2. Modal.tsx

**File Path**: `src/components/ui/Modal.tsx` (NEW FILE)

```typescript
import React, { useEffect, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnEscape?: boolean
  closeOnBackdropClick?: boolean
}

const getModalWidth = (size: 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
  const widths = {
    sm: '400px',
    md: '600px',
    lg: '800px',
    xl: '1000px',
  }
  return widths[size]
}

export const Modal = React.memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdropClick = true,
}) => {
  const modalWidth = useMemo(() => getModalWidth(size), [size])

  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose()
      }
    },
    [onClose, closeOnEscape],
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose, closeOnBackdropClick],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleEscapeKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleEscapeKey])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: `fadeIn ${transitions.base}`,
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.lg,
          width: modalWidth,
          maxWidth: 'calc(100% - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          animation: `slideUp ${transitions.base}`,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: spacing['5'],
          borderBottom: `1px solid ${colors.borderDefault}`,
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{
                margin: `${spacing['1']} 0 0`,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              transition: `color ${transitions.instant}`,
              '&:hover': { color: colors.textPrimary },
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing['5'],
        }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
})
Modal.displayName = 'Modal'
```

### 3. InputField.tsx

**File Path**: `src/components/ui/InputField.tsx` (NEW FILE)

```typescript
import React, { useCallback } from 'react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

export const InputField = React.memo<InputFieldProps>(({
  label,
  error,
  helpText,
  onChange,
  onFocus,
  onBlur,
  disabled,
  ...rest
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e)
      }
    },
    [onChange],
  )

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (onFocus) {
        onFocus(e)
      }
    },
    [onFocus],
  )

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (onBlur) {
        onBlur(e)
      }
    },
    [onBlur],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {label && (
        <label style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: colors.textPrimary,
          fontFamily: typography.fontFamily,
        }}>
          {label}
        </label>
      )}
      <input
        {...rest}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        style={{
          padding: `${spacing['2']} ${spacing['3']}`,
          border: `1px solid ${error ? colors.statusCritical : colors.borderDefault}`,
          borderRadius: borderRadius.base,
          backgroundColor: disabled ? colors.surfaceInset : colors.white,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          transition: `all ${transitions.instant}`,
          cursor: disabled ? 'not-allowed' : 'text',
          ...rest.style,
        }}
      />
      {error && (
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.caption,
          color: colors.statusCritical,
        }}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          {helpText}
        </p>
      )}
    </div>
  )
})
InputField.displayName = 'InputField'
```

### 4. PageContainer.tsx

**File Path**: `src/components/ui/PageContainer.tsx` (NEW FILE)

```typescript
import React, { useMemo } from 'react'
import { colors, spacing, typography } from '../../styles/theme'

export interface PageContainerProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
}

export const PageContainer = React.memo<PageContainerProps>(({
  title,
  subtitle,
  actions,
  children,
  maxWidth = '1400px',
}) => {
  const headerStyles = useMemo(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing['4'],
    marginBottom: spacing['5'],
  }), [])

  return (
    <div style={{
      maxWidth,
      margin: '0 auto',
      padding: `${spacing['5']} ${spacing['5']}`,
      backgroundColor: colors.pageBackground,
      minHeight: '100vh',
    }}>
      <div style={headerStyles}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: 0,
            fontSize: typography.fontSize.pageTitle,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              margin: `${spacing['1']} 0 0`,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            {actions}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {children}
      </div>
    </div>
  )
})
PageContainer.displayName = 'PageContainer'
```

### 5. Label.tsx

**File Path**: `src/components/ui/Label.tsx` (NEW FILE)

```typescript
import React from 'react'
import { colors, typography, spacing } from '../../styles/theme'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  children: React.ReactNode
}

export const Label = React.memo<LabelProps>(({ required, children, ...rest }) => (
  <label
    {...rest}
    style={{
      display: 'block',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.textPrimary,
      fontFamily: typography.fontFamily,
      marginBottom: spacing['2'],
      ...rest.style,
    }}
  >
    {children}
    {required && (
      <span style={{ color: colors.statusCritical, marginLeft: spacing['1'] }}>*</span>
    )}
  </label>
))
Label.displayName = 'Label'
```

### 6. Checkbox.tsx

**File Path**: `src/components/ui/Checkbox.tsx` (NEW FILE)

```typescript
import React, { useCallback } from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, borderRadius, transitions } from '../../styles/theme'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Checkbox = React.memo<CheckboxProps>(({
  label,
  onChange,
  checked,
  disabled,
  ...rest
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e)
      }
    },
    [onChange],
  )

  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <input
        {...rest}
        type="checkbox"
        onChange={handleChange}
        checked={checked}
        disabled={disabled}
        style={{
          position: 'absolute',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
      <div style={{
        width: 18,
        height: 18,
        border: `2px solid ${checked ? colors.primaryOrange : colors.borderDefault}`,
        borderRadius: borderRadius.sm,
        backgroundColor: checked ? colors.primaryOrange : colors.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `all ${transitions.instant}`,
        flexShrink: 0,
      }}>
        {checked && <Check size={12} color={colors.white} />}
      </div>
      {label && <span>{label}</span>}
    </label>
  )
})
Checkbox.displayName = 'Checkbox'
```

---

## Index File for Barrel Export

**File Path**: `src/components/ui/index.ts` (NEW FILE)

```typescript
// Barrel export maintains backward compatibility
export { Btn, type BtnProps } from './Button'
export { Modal, type ModalProps } from './Modal'
export { InputField, type InputFieldProps } from './InputField'
export { PageContainer, type PageContainerProps } from './PageContainer'
export { Label, type LabelProps } from './Label'
export { Checkbox, type CheckboxProps } from './Checkbox'

// Export remaining components after they are created
// (Card, MetricBox, StatusTag, etc. - already have React.memo)

// For gradual migration, existing imports from Primitives should still work
```

---

## Update Primitives.tsx (Migration Path)

**File Path**: `src/components/Primitives.tsx`

Keep the file but add re-exports for backward compatibility during migration:

```typescript
// ── DEPRECATED: Use components from ./ui/ directory instead ──
// This file maintained for backward compatibility only
// All components have been moved to src/components/ui/

export { Btn, type BtnProps } from './ui/Button'
export { Modal, type ModalProps } from './ui/Modal'
export { InputField, type InputFieldProps } from './ui/InputField'
export { PageContainer, type PageContainerProps } from './ui/PageContainer'
export { Label, type LabelProps } from './ui/Label'
export { Checkbox, type CheckboxProps } from './ui/Checkbox'

// ... continue re-exports for all other components
```

---

## Performance Checklist

After completing refactoring:

**React.memo Status**:
- [ ] Btn component wrapped with React.memo
- [ ] PageContainer component wrapped with React.memo
- [ ] Modal component wrapped with React.memo
- [ ] InputField component wrapped with React.memo
- [ ] TableHeader component wrapped with React.memo
- [ ] SectionHeader component wrapped with React.memo
- [ ] Tag component wrapped with React.memo
- [ ] TabBar component wrapped with React.memo
- [ ] ProgressBar component wrapped with React.memo
- [ ] DetailPanel component wrapped with React.memo
- [ ] Skeleton component wrapped with React.memo
- [ ] EmptyState component wrapped with React.memo
- [ ] Dot component wrapped with React.memo
- [ ] AIRing component wrapped with React.memo
- [ ] RelatedItems component wrapped with React.memo
- [ ] CommandPalette component wrapped with React.memo
- [ ] All other components already have memo (verify)

**useMemo/useCallback Status**:
- [ ] All onClick handlers use useCallback
- [ ] All onChange handlers use useCallback
- [ ] All onClose/onSuccess handlers use useCallback
- [ ] All derived styles use useMemo
- [ ] All computed widths/dimensions use useMemo
- [ ] All object/array literals in props use useMemo

**LAW 7 Compliance**:
- [ ] No hardcoded color values (all from colors object)
- [ ] No hardcoded spacing values (all from spacing object)
- [ ] No hardcoded font sizes (all from typography object)
- [ ] No hardcoded border radius (all from borderRadius object)
- [ ] No hardcoded transition values (all from transitions object)

**Directory Structure**:
- [ ] src/components/ui/ directory created
- [ ] All component files created in ui/
- [ ] ui/index.ts barrel export created
- [ ] Primitives.tsx updated to re-export from ui/
- [ ] All existing imports still work without changes

**Testing**:
- [ ] No regressions in visual rendering
- [ ] No regressions in functionality
- [ ] Performance improved (measure LCP, FID, CLS)
- [ ] Bundle size maintained or improved
- [ ] No console errors or warnings

