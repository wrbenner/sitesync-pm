# Phase 1E — Split Primitives.tsx + Add React.memo Everywhere

**Status**: Foundation Layer | **Priority**: High | **Effort**: 28 hours | **Risk**: Medium

## Pre-Requisite: Paste 00_SYSTEM_CONTEXT.md before this prompt

---

## Problem Statement

**Audit Findings**:
- `Primitives.tsx` is 1,513 lines (single file)
- 24 components exported (impossible to understand at a glance)
- 16 missing `React.memo` (unnecessary re-renders)
- 9 components without proper prop memoization
- No barrel export organization

**Current State**:
- Every change to any component recompiles entire file
- Large file = hard to read and maintain
- Missing React.memo allows child re-renders on parent updates
- No useCallback for event handlers passed as props
- No useMemo for derived values
- Debug tools show 5-10 unnecessary re-renders per interaction

**Target State**:
- Each component in own file under `src/components/ui/`
- All 24 components wrapped with `React.memo`
- All event handlers wrapped with `useCallback`
- All derived values wrapped with `useMemo`
- Clean barrel export from `src/components/ui/index.ts`
- Zero unnecessary re-renders

---

## Current Components in Primitives.tsx

### With React.memo (6 components)
- [ ] Card (line ~50) — already memoized
- [ ] MetricBox (line ~120) — already memoized
- [ ] StatusTag (line ~180) — already memoized
- [ ] PriorityTag (line ~220) — already memoized
- [ ] TableRow (line ~260) — already memoized
- [ ] Avatar (line ~300) — already memoized

### Missing React.memo (18 components)
- [ ] PageContainer (line ~35) — **NEEDS MEMO**
- [ ] Btn (line ~80) — **NEEDS MEMO**
- [ ] Tag (line ~160) — **NEEDS MEMO**
- [ ] SectionHeader (line ~200) — **NEEDS MEMO**
- [ ] TableHeader (line ~240) — **NEEDS MEMO**
- [ ] Modal (line ~320) — **NEEDS MEMO**
- [ ] TabBar (line ~380) — **NEEDS MEMO**
- [ ] ProgressBar (line ~420) — **NEEDS MEMO**
- [ ] Dot (line ~440) — **NEEDS MEMO**
- [ ] AIRing (line ~460) — **NEEDS MEMO**
- [ ] InputField (line ~500) — **NEEDS MEMO**
- [ ] RelatedItems (line ~560) — **NEEDS MEMO**
- [ ] ToastProvider (line ~600) — **PROVIDER** (no memo)
- [ ] CommandPalette (line ~700) — **NEEDS MEMO**
- [ ] DetailPanel (line ~800) — **NEEDS MEMO**
- [ ] Skeleton (line ~900) — **NEEDS MEMO**
- [ ] EmptyState (line ~1000) — **NEEDS MEMO**
- [ ] Table (line ~1050) — **NEEDS MEMO**

---

## File Structure: New Directory Layout

```
src/components/
  ui/
    Primitives/
      PageContainer.tsx
      Btn.tsx
      Card.tsx
      Tag.tsx
      MetricBox.tsx
      SectionHeader.tsx
      TableHeader.tsx
      TableRow.tsx
      Table.tsx
      Modal.tsx
      TabBar.tsx
      ProgressBar.tsx
      Dot.tsx
      StatusTag.tsx
      PriorityTag.tsx
      Avatar.tsx
      AIRing.tsx
      InputField.tsx
      RelatedItems.tsx
      ToastProvider.tsx
      CommandPalette.tsx
      DetailPanel.tsx
      Skeleton.tsx
      EmptyState.tsx
      index.ts
  Sidebar.tsx
  TopBar.tsx
  PermissionGate.tsx
  PresenceIndicator.tsx
  index.ts
```

---

## Component Split: Complete Examples

### Example 1: PageContainer.tsx (Container, needs memo)

**File**: `src/components/ui/Primitives/PageContainer.tsx`

```typescript
import React, { ReactNode, CSSProperties } from 'react';
import styles from '@/styles/theme';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: number;
  padding?: number;
  gap?: number;
  flexDirection?: 'row' | 'column';
  style?: CSSProperties;
}

const PageContainerComponent: React.FC<PageContainerProps> = ({
  children,
  maxWidth = 1400,
  padding = styles.spacing.lg,
  gap = styles.spacing.md,
  flexDirection = 'column',
  style,
}) => {
  return (
    <div
      style={{
        maxWidth,
        margin: '0 auto',
        padding,
        display: 'flex',
        flexDirection,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const PageContainer = React.memo(PageContainerComponent);
PageContainer.displayName = 'PageContainer';
```

### Example 2: Btn.tsx (Button, needs memo)

**File**: `src/components/ui/Primitives/Btn.tsx`

```typescript
import React, { ButtonHTMLAttributes, useCallback, ReactNode } from 'react';
import styles from '@/styles/theme';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const BtnComponent = React.forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      fullWidth = false,
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    // Memoize click handler to prevent parent re-renders
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isLoading && !disabled && onClick) {
          onClick(e);
        }
      },
      [isLoading, disabled, onClick]
    );

    // Memoize styles to prevent recalculation on every render
    const getVariantStyles = useCallback(() => {
      const baseStyles = {
        padding:
          size === 'sm'
            ? `${styles.spacing.xs} ${styles.spacing.sm}`
            : size === 'lg'
              ? `${styles.spacing.md} ${styles.spacing.lg}`
              : `${styles.spacing.sm} ${styles.spacing.md}`,
        fontSize:
          size === 'sm' ? 12 : size === 'lg' ? 16 : 14,
        fontWeight: 600,
        border: 'none',
        borderRadius: 4,
        cursor: isLoading || disabled ? 'not-allowed' : 'pointer',
        opacity: isLoading || disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: icon ? styles.spacing.xs : 0,
        width: fullWidth ? '100%' : 'auto',
      };

      const variantStyles = {
        primary: {
          backgroundColor: styles.colors.primary,
          color: 'white',
          '&:hover': { backgroundColor: styles.colors.primaryHover },
        },
        secondary: {
          backgroundColor: styles.colors.secondary,
          color: styles.colors.text,
          border: `1px solid ${styles.colors.border}`,
          '&:hover': { backgroundColor: styles.colors.secondaryHover },
        },
        tertiary: {
          backgroundColor: 'transparent',
          color: styles.colors.text,
          '&:hover': { backgroundColor: styles.colors.tertiary },
        },
        danger: {
          backgroundColor: styles.colors.danger,
          color: 'white',
          '&:hover': { backgroundColor: styles.colors.dangerHover },
        },
      };

      return { ...baseStyles, ...variantStyles[variant] };
    }, [variant, size, isLoading, disabled, icon, fullWidth]);

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={isLoading || disabled}
        style={getVariantStyles()}
        {...props}
      >
        {icon && <span>{icon}</span>}
        {isLoading ? 'Loading...' : children}
      </button>
    );
  }
);

BtnComponent.displayName = 'Btn';
export const Btn = React.memo(BtnComponent);
```

### Example 3: InputField.tsx (Form input, needs memo)

**File**: `src/components/ui/Primitives/InputField.tsx`

```typescript
import React, { InputHTMLAttributes, useCallback, useMemo } from 'react';
import styles from '@/styles/theme';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const InputFieldComponent = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      error,
      helper,
      icon,
      fullWidth = false,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    // Memoize change handler to prevent parent re-renders
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
          onChange(e);
        }
      },
      [onChange]
    );

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onFocus) {
          onFocus(e);
        }
      },
      [onFocus]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (onBlur) {
          onBlur(e);
        }
      },
      [onBlur]
    );

    // Memoize computed styles
    const containerStyle = useMemo(
      () => ({
        display: 'flex',
        flexDirection: 'column' as const,
        gap: styles.spacing.xs,
        width: fullWidth ? '100%' : 'auto',
      }),
      [fullWidth]
    );

    const inputStyle = useMemo(
      () => ({
        padding: `${styles.spacing.sm} ${styles.spacing.md}`,
        border: error
          ? `2px solid ${styles.colors.danger}`
          : `1px solid ${styles.colors.border}`,
        borderRadius: 4,
        fontSize: 14,
        fontFamily: 'inherit',
        backgroundColor: styles.colors.background,
        color: styles.colors.text,
        transition: 'border-color 0.2s ease',
        paddingLeft: icon ? 36 : styles.spacing.md,
        '&:focus': {
          outline: 'none',
          borderColor: styles.colors.primary,
        },
      }),
      [error, icon]
    );

    return (
      <div style={containerStyle}>
        {label && (
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: styles.colors.textSecondary,
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <input
            ref={ref}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={inputStyle}
            {...props}
          />
          {icon && (
            <span
              style={{
                position: 'absolute',
                left: styles.spacing.md,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              {icon}
            </span>
          )}
        </div>
        {error && (
          <span
            style={{
              fontSize: 12,
              color: styles.colors.danger,
              fontWeight: 500,
            }}
          >
            {error}
          </span>
        )}
        {helper && !error && (
          <span
            style={{
              fontSize: 12,
              color: styles.colors.textSecondary,
            }}
          >
            {helper}
          </span>
        )}
      </div>
    );
  }
);

InputFieldComponent.displayName = 'InputField';
export const InputField = React.memo(InputFieldComponent);
```

### Example 4: Card.tsx (Already has memo, refactor)

**File**: `src/components/ui/Primitives/Card.tsx`

```typescript
import React, { ReactNode, CSSProperties } from 'react';
import styles from '@/styles/theme';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  padding?: number;
  gap?: number;
  style?: CSSProperties;
  hoverable?: boolean;
}

const CardComponent: React.FC<CardProps> = ({
  children,
  onClick,
  padding = styles.spacing.md,
  gap = styles.spacing.md,
  style,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: styles.colors.card,
        borderRadius: 8,
        border: `1px solid ${styles.colors.border}`,
        padding,
        display: 'flex',
        flexDirection: 'column',
        gap,
        cursor: hoverable ? 'pointer' : 'default',
        transition: hoverable ? 'all 0.2s ease' : 'none',
        '&:hover': hoverable
          ? {
              boxShadow: styles.shadows.md,
              borderColor: styles.colors.primary,
            }
          : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

CardComponent.displayName = 'Card';
export const Card = React.memo(CardComponent);
```

### Example 5: Modal.tsx (Complex, needs memo)

**File**: `src/components/ui/Primitives/Modal.tsx`

```typescript
import React, { ReactNode, useCallback, useMemo } from 'react';
import styles from '@/styles/theme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  width?: number;
  size?: 'sm' | 'md' | 'lg';
}

const ModalComponent: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  width,
  size = 'md',
}) => {
  // Memoize close handler
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoize click handler for backdrop
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Memoize width calculation
  const computedWidth = useMemo(() => {
    return (
      width ||
      (size === 'sm' ? 400 : size === 'lg' ? 800 : 600)
    );
  }, [width, size]);

  // Memoize styles
  const backdropStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: isOpen ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }),
    [isOpen]
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: styles.colors.background,
      borderRadius: 8,
      width: computedWidth,
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: styles.shadows.lg,
      display: 'flex',
      flexDirection: 'column',
    }),
    [computedWidth]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: styles.spacing.lg,
      borderBottom: `1px solid ${styles.colors.border}`,
    }),
    []
  );

  const bodyStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: styles.spacing.lg,
      flex: 1,
      overflowY: 'auto',
    }),
    []
  );

  const footerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: styles.spacing.md,
      padding: styles.spacing.lg,
      borderTop: `1px solid ${styles.colors.border}`,
    }),
    []
  );

  return (
    <div style={backdropStyle} onClick={handleBackdropClick}>
      <div style={contentStyle}>
        {title && (
          <div style={headerStyle}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {title}
            </h2>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                padding: 0,
                width: 24,
                height: 24,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={bodyStyle}>{children}</div>
        {actions && <div style={footerStyle}>{actions}</div>}
      </div>
    </div>
  );
};

ModalComponent.displayName = 'Modal';
export const Modal = React.memo(ModalComponent);
```

---

## Barrel Export: New Organization

**File**: `src/components/ui/Primitives/index.ts`

```typescript
// Layouts
export { PageContainer } from './PageContainer';
export type { PageContainerProps } from './PageContainer';

// Buttons
export { Btn } from './Btn';
export type { BtnProps } from './Btn';

// Cards and containers
export { Card } from './Card';
export type { CardProps } from './Card';

export { MetricBox } from './MetricBox';
export type { MetricBoxProps } from './MetricBox';

// Tags and labels
export { Tag } from './Tag';
export type { TagProps } from './Tag';

export { StatusTag } from './StatusTag';
export type { StatusTagProps } from './StatusTag';

export { PriorityTag } from './PriorityTag';
export type { PriorityTagProps } from './PriorityTag';

// Tables
export { Table } from './Table';
export type { TableProps } from './Table';

export { TableHeader } from './TableHeader';
export type { TableHeaderProps } from './TableHeader';

export { TableRow } from './TableRow';
export type { TableRowProps } from './TableRow';

// Forms
export { InputField } from './InputField';
export type { InputFieldProps } from './InputField';

// Headers
export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';

// Modals and overlays
export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { DetailPanel } from './DetailPanel';
export type { DetailPanelProps } from './DetailPanel';

// Navigation
export { TabBar } from './TabBar';
export type { TabBarProps } from './TabBar';

// Progress and indicators
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { Dot } from './Dot';
export type { DotProps } from './Dot';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { AIRing } from './AIRing';
export type { AIRingProps } from './AIRing';

// Related content
export { RelatedItems } from './RelatedItems';
export type { RelatedItemsProps } from './RelatedItems';

// Providers
export { ToastProvider } from './ToastProvider';
export type { ToastProviderProps } from './ToastProvider';

// Rich UI
export { CommandPalette } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
```

---

## Parent Components: Update Imports

### Dashboard.tsx Refactor

**BEFORE**:
```typescript
import {
  PageContainer,
  Card,
  MetricBox,
  SectionHeader,
  Btn,
} from '@/components/Primitives';
```

**AFTER**:
```typescript
import {
  PageContainer,
  Card,
  MetricBox,
  SectionHeader,
  Btn,
} from '@/components/ui/Primitives';

// Add memoization to expensive components
export const Dashboard = React.memo(DashboardComponent);
```

### All Import Updates Needed

1. `src/pages/Dashboard.tsx` — 6 imports from Primitives
2. `src/pages/RFIs.tsx` — 8 imports from Primitives
3. `src/pages/Submittals.tsx` — 8 imports from Primitives
4. `src/pages/PunchList.tsx` — 7 imports from Primitives
5. `src/pages/Schedule.tsx` — 9 imports from Primitives
6. `src/pages/Budget.tsx` — 7 imports from Primitives
7. `src/pages/DailyLog.tsx` — 8 imports from Primitives
8. `src/pages/FieldCapture.tsx` — 7 imports from Primitives
9. `src/pages/Meetings.tsx` — 6 imports from Primitives
10. `src/pages/Files.tsx` — 6 imports from Primitives
11. `src/pages/Crews.tsx` — 6 imports from Primitives
12. `src/pages/Directory.tsx` — 6 imports from Primitives
13. `src/pages/Drawings.tsx` — 5 imports from Primitives
14. `src/pages/AICopilot.tsx` — 6 imports from Primitives
15. `src/pages/Vision.tsx` — 4 imports from Primitives
16. `src/components/Sidebar.tsx` — 4 imports from Primitives
17. `src/components/TopBar.tsx` — 5 imports from Primitives
18. `src/App.tsx` — 2 imports from Primitives

---

## Performance Optimization: useCallback and useMemo

### Page Component Pattern

**File**: `src/pages/RFIs.tsx` (Optimized)

```typescript
import React, { useCallback, useMemo, useState } from 'react';

interface RFIsState {
  selectedRFI?: RFI;
  showCreateModal: boolean;
  filters: RFIFilters;
}

const RFIsComponent: React.FC = () => {
  const [state, setState] = useState<RFIsState>({
    showCreateModal: false,
  });

  const { data: rfis } = useQuery(['rfis']);

  // Memoize filters to prevent re-computing
  const filteredRFIs = useMemo(() => {
    if (!rfis) return [];
    return rfis.filter((rfi) => {
      if (state.filters.status && rfi.status !== state.filters.status) {
        return false;
      }
      if (state.filters.priority && rfi.priority !== state.filters.priority) {
        return false;
      }
      return true;
    });
  }, [rfis, state.filters]);

  // Memoize handler to prevent child re-renders
  const handleSelectRFI = useCallback((rfi: RFI) => {
    setState((prev) => ({ ...prev, selectedRFI: rfi }));
  }, []);

  const handleCreateRFI = useCallback((input: CreateRFIInput) => {
    createRFI.mutate(input);
  }, [createRFI]);

  const handleCloseModal = useCallback(() => {
    setState((prev) => ({ ...prev, showCreateModal: false }));
  }, []);

  // Memoize computed status counts
  const statusCounts = useMemo(() => {
    if (!rfis) return { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    return {
      open: rfis.filter((r) => r.status === 'OPEN').length,
      inProgress: rfis.filter((r) => r.status === 'IN_PROGRESS').length,
      resolved: rfis.filter((r) => r.status === 'RESOLVED').length,
      closed: rfis.filter((r) => r.status === 'CLOSED').length,
    };
  }, [rfis]);

  return (
    <PageContainer>
      <SectionHeader title="Requests for Information">
        <Btn onClick={() => setState((prev) => ({ ...prev, showCreateModal: true }))}>
          New RFI
        </Btn>
      </SectionHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricBox label="Open" value={statusCounts.open} color="blue" />
        <MetricBox label="In Progress" value={statusCounts.inProgress} color="amber" />
        <MetricBox label="Resolved" value={statusCounts.resolved} color="green" />
        <MetricBox label="Closed" value={statusCounts.closed} color="gray" />
      </div>

      <Table>
        {filteredRFIs.map((rfi) => (
          <TableRow
            key={rfi.id}
            onClick={() => handleSelectRFI(rfi)}
          >
            <td>{rfi.title}</td>
            <td>{rfi.status}</td>
          </TableRow>
        ))}
      </Table>

      {state.selectedRFI && (
        <DetailPanel onClose={handleCloseModal}>
          {/* Detail content */}
        </DetailPanel>
      )}

      <Modal
        isOpen={state.showCreateModal}
        onClose={handleCloseModal}
        title="Create RFI"
      >
        <CreateRFIForm onSubmit={handleCreateRFI} />
      </Modal>
    </PageContainer>
  );
};

export const RFIs = React.memo(RFIsComponent);
```

---

## Component Split Checklist

### Create New Files (24 components)

**Layouts**:
- [ ] `src/components/ui/Primitives/PageContainer.tsx` — + React.memo + displayName
- [ ] Types: `PageContainerProps` in same file

**Buttons & CTAs**:
- [ ] `src/components/ui/Primitives/Btn.tsx` — + React.memo + useCallback + useMemo + displayName
- [ ] Types: `BtnProps` in same file

**Cards**:
- [ ] `src/components/ui/Primitives/Card.tsx` — already has memo, refactor to extract to file
- [ ] Types: `CardProps` in same file

- [ ] `src/components/ui/Primitives/MetricBox.tsx` — already has memo, refactor to extract
- [ ] Types: `MetricBoxProps` in same file

**Tags & Labels**:
- [ ] `src/components/ui/Primitives/Tag.tsx` — + React.memo + displayName
- [ ] Types: `TagProps` in same file

- [ ] `src/components/ui/Primitives/StatusTag.tsx` — already has memo, refactor
- [ ] Types: `StatusTagProps` in same file

- [ ] `src/components/ui/Primitives/PriorityTag.tsx` — already has memo, refactor
- [ ] Types: `PriorityTagProps` in same file

**Tables**:
- [ ] `src/components/ui/Primitives/Table.tsx` — + React.memo + displayName
- [ ] Types: `TableProps` in same file

- [ ] `src/components/ui/Primitives/TableHeader.tsx` — + React.memo + displayName
- [ ] Types: `TableHeaderProps` in same file

- [ ] `src/components/ui/Primitives/TableRow.tsx` — already has memo, refactor
- [ ] Types: `TableRowProps` in same file

**Forms**:
- [ ] `src/components/ui/Primitives/InputField.tsx` — + React.memo + useCallback + useMemo + displayName
- [ ] Types: `InputFieldProps` in same file

**Headers**:
- [ ] `src/components/ui/Primitives/SectionHeader.tsx` — + React.memo + displayName
- [ ] Types: `SectionHeaderProps` in same file

**Modals**:
- [ ] `src/components/ui/Primitives/Modal.tsx` — + React.memo + useCallback + useMemo + displayName
- [ ] Types: `ModalProps` in same file

- [ ] `src/components/ui/Primitives/DetailPanel.tsx` — + React.memo + useCallback + useMemo + displayName
- [ ] Types: `DetailPanelProps` in same file

**Navigation**:
- [ ] `src/components/ui/Primitives/TabBar.tsx` — + React.memo + useCallback + displayName
- [ ] Types: `TabBarProps` in same file

**Progress & Indicators**:
- [ ] `src/components/ui/Primitives/ProgressBar.tsx` — + React.memo + useMemo + displayName
- [ ] Types: `ProgressBarProps` in same file

- [ ] `src/components/ui/Primitives/Dot.tsx` — + React.memo + displayName
- [ ] Types: `DotProps` in same file

- [ ] `src/components/ui/Primitives/Avatar.tsx` — already has memo, refactor
- [ ] Types: `AvatarProps` in same file

- [ ] `src/components/ui/Primitives/AIRing.tsx` — + React.memo + displayName
- [ ] Types: `AIRingProps` in same file

**Related Content**:
- [ ] `src/components/ui/Primitives/RelatedItems.tsx` — + React.memo + useCallback + displayName
- [ ] Types: `RelatedItemsProps` in same file

**Providers** (no memo):
- [ ] `src/components/ui/Primitives/ToastProvider.tsx` — Provider, no memo
- [ ] Types: `ToastProviderProps` in same file

**Rich UI**:
- [ ] `src/components/ui/Primitives/CommandPalette.tsx` — + React.memo + useCallback + useMemo + displayName
- [ ] Types: `CommandPaletteProps` in same file

- [ ] `src/components/ui/Primitives/Skeleton.tsx` — + React.memo + useMemo + displayName
- [ ] Types: `SkeletonProps` in same file

- [ ] `src/components/ui/Primitives/EmptyState.tsx` — + React.memo + displayName
- [ ] Types: `EmptyStateProps` in same file

### Update Imports (18 files)

- [ ] `src/pages/Dashboard.tsx` — Update all Primitives imports
- [ ] `src/pages/RFIs.tsx` — Update all Primitives imports
- [ ] `src/pages/Submittals.tsx` — Update all Primitives imports
- [ ] `src/pages/PunchList.tsx` — Update all Primitives imports
- [ ] `src/pages/Schedule.tsx` — Update all Primitives imports
- [ ] `src/pages/Budget.tsx` — Update all Primitives imports
- [ ] `src/pages/DailyLog.tsx` — Update all Primitives imports
- [ ] `src/pages/FieldCapture.tsx` — Update all Primitives imports
- [ ] `src/pages/Meetings.tsx` — Update all Primitives imports
- [ ] `src/pages/Files.tsx` — Update all Primitives imports
- [ ] `src/pages/Crews.tsx` — Update all Primitives imports
- [ ] `src/pages/Directory.tsx` — Update all Primitives imports
- [ ] `src/pages/Drawings.tsx` — Update all Primitives imports
- [ ] `src/pages/AICopilot.tsx` — Update all Primitives imports
- [ ] `src/pages/Vision.tsx` — Update all Primitives imports
- [ ] `src/components/Sidebar.tsx` — Update all Primitives imports
- [ ] `src/components/TopBar.tsx` — Update all Primitives imports
- [ ] `src/App.tsx` — Update all Primitives imports

### Add Memoization to Page Components (15 files)

- [ ] `src/pages/Dashboard.tsx` — Wrap component with React.memo
- [ ] `src/pages/RFIs.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Submittals.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/PunchList.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Schedule.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Budget.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/DailyLog.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/FieldCapture.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Meetings.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Files.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Crews.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Directory.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Drawings.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/AICopilot.tsx` — Wrap component with React.memo + add useMemo/useCallback
- [ ] `src/pages/Vision.tsx` — Wrap component with React.memo + add useMemo/useCallback

### Update Component Exports

- [ ] Delete `src/components/Primitives.tsx` (after all exports moved)
- [ ] Create `src/components/ui/Primitives/index.ts` with barrel export
- [ ] Update `src/components/index.ts` to export from new location
- [ ] Verify all imports compile

---

## Verification: React DevTools Profiler

After splitting, use React DevTools Profiler to verify:

```typescript
// Open React DevTools > Profiler tab
// 1. Record interaction
// 2. Expand component tree
// 3. Check "Rendered" duration for each component
// 4. Verify no components render if props unchanged
// 5. No component should render > 1ms for no-change scenario

// Expected results:
// - PageContainer: 0.1ms (memoized)
// - Btn: 0.1ms (memoized)
// - Card: 0.1ms (memoized)
// - Table: 0.2ms (memoized, contains rows)
// - TableRow: 0.1ms each (memoized)
// Total dashboard: < 5ms full re-render
```

---

## Acceptance Criteria

- [ ] All 24 components moved from Primitives.tsx to individual files in `src/components/ui/Primitives/`
- [ ] Each component file exports default memoized component + displayName
- [ ] Each component file exports TypeScript interface for props
- [ ] All 18 components missing React.memo now wrapped with React.memo
- [ ] All event handlers in components use useCallback
- [ ] All derived values in components use useMemo
- [ ] Barrel export created at `src/components/ui/Primitives/index.ts`
- [ ] All 18 files with Primitives imports updated to new path
- [ ] All 15 page components wrapped with React.memo
- [ ] All page components use useMemo for filtered/computed data
- [ ] All page components use useCallback for event handlers passed to children
- [ ] `src/components/Primitives.tsx` deleted after migration complete
- [ ] Code compiles with zero TypeScript errors
- [ ] All imports resolve correctly
- [ ] React DevTools Profiler shows < 1ms per component for no-change renders
- [ ] No memory leaks from callback/memo hooks
- [ ] Verified with React DevTools that unnecessary re-renders eliminated

---

**Effort estimate**: 28 hours
**Status**: Ready for implementation
**Owner**: Frontend engineer
**Review**: Frontend architect + Performance lead
