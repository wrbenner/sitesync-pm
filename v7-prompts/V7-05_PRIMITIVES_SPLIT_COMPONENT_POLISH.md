# V7-05: Primitives Split & Component Polish

## Goal
Split the monolithic `Primitives.tsx` (1,513 lines, 24 components) into individual files, add `React.memo` to all components, and polish every primitive to Steve Jobs quality. Each component becomes its own file with dedicated hover states, animations, and pixel-perfect styling.

## Why This Matters
`Primitives.tsx` was supposed to be split in V5 Phase 1E but never was. A single 1,500-line file with 24 components is:
- Hard to maintain (changes to Card can break MetricBox)
- Hard to review (every PR touches this one file)
- Hard to tree-shake (importing Tag imports all 24 components)
- A signal of technical debt that undermines team confidence

Steve Jobs would never ship a product built on a foundation this messy. Split it. Polish each piece. Make every component a jewel.

---

## Phase 1: File Structure

### 1A. Create the Directory

```
src/components/primitives/
  index.ts              # Re-exports everything (backward compat)
  PageContainer.tsx
  Card.tsx
  Btn.tsx
  MetricBox.tsx
  Tag.tsx
  StatusTag.tsx
  PriorityTag.tsx
  SectionHeader.tsx
  TableHeader.tsx
  TableRow.tsx
  Modal.tsx
  TabBar.tsx
  Avatar.tsx
  ProgressBar.tsx
  Dot.tsx
  AIRing.tsx
  InputField.tsx
  RelatedItems.tsx
  ToastProvider.tsx
  CommandPalette.tsx    # Already in shared/, just re-export
  DetailPanel.tsx
  Skeleton.tsx
  EmptyState.tsx
```

### 1B. Index File

```typescript
// src/components/primitives/index.ts
export { PageContainer } from './PageContainer';
export { Card } from './Card';
export { Btn } from './Btn';
export { MetricBox } from './MetricBox';
export { Tag } from './Tag';
export { StatusTag } from './StatusTag';
export { PriorityTag } from './PriorityTag';
export { SectionHeader } from './SectionHeader';
export { TableHeader } from './TableHeader';
export { TableRow } from './TableRow';
export { Modal } from './Modal';
export { TabBar } from './TabBar';
export { Avatar } from './Avatar';
export { ProgressBar } from './ProgressBar';
export { Dot } from './Dot';
export { AIRing } from './AIRing';
export { InputField } from './InputField';
export { RelatedItems } from './RelatedItems';
export { ToastProvider, useToast } from './ToastProvider';
export { DetailPanel } from './DetailPanel';
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';
// Re-export Sidebar context (move to Sidebar or layout)
export { SidebarContext, useSidebar } from '../Sidebar';
```

### 1C. Migration Steps

1. Create `src/components/primitives/` directory
2. For each component in `Primitives.tsx`:
   a. Create the new file
   b. Copy the component code
   c. Add proper imports (theme tokens, React, lucide-react, etc.)
   d. Add `React.memo` wrapper if missing
   e. Add proper TypeScript interface for props
3. Create `index.ts` that re-exports everything
4. Update `Primitives.tsx` to just re-export from the new location (temporary backward compat)
5. Update all imports across the codebase from `'../Primitives'` or `'./Primitives'` to `'../primitives'` or `'@/components/primitives'`
6. Once all imports are updated, delete the original `Primitives.tsx`

**CRITICAL:** Use find-and-replace across ALL files. The import path `./Primitives` or `../Primitives` or `../../components/Primitives` appears in nearly every page and component file. Every single one must be updated.

---

## Phase 2: Component Polish

### 2A. Card Component

Current: Basic white box with border and shadow.
Target: Apple-level card with hover lift, subtle border animation, and proper content spacing.

```typescript
interface CardProps {
  children: React.ReactNode;
  padding?: string;
  onClick?: () => void;
  hoverable?: boolean;
  selected?: boolean;
  style?: React.CSSProperties;
}

const Card = React.memo(function Card({
  children,
  padding = spacing[5],
  onClick,
  hoverable = !!onClick,
  selected = false,
  style,
}: CardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: selected ? colors.surfaceSelected : colors.surfaceRaised,
        border: `1px solid ${selected ? colors.primaryOrange : hovered && hoverable ? colors.borderDefault : colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding,
        boxShadow: hovered && hoverable ? shadows.cardHover : shadows.card,
        transform: hovered && hoverable ? 'translateY(-2px)' : 'translateY(0)',
        transition: `all ${duration.normal}ms ${easing.standard}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
});
```

### 2B. Btn Component

The button is the most important interactive element. It must feel incredible.

**Variants:**
- `primary`: Orange background, white text
- `secondary`: White background, dark text, subtle border
- `ghost`: Transparent background, text color inherits
- `danger`: Red background, white text
- `ai`: Indigo gradient background, white text

**Sizes:**
- `sm`: 32px height, 12px font, 12px horizontal padding
- `md`: 36px height, 13px font, 16px horizontal padding
- `lg`: 44px height, 14px font, 20px horizontal padding

**States:**
- Default → Hover → Active/Press → Disabled
- Each state has distinct background, shadow, and transform

```typescript
interface BtnProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}
```

**Loading state:**
- Replace button text with a small spinner (16px, spinning with CSS `spin` keyframe)
- Button width stays the same (use `min-width` set on first render)
- Opacity: 0.7 on the background
- Cursor: `wait`

**Disabled state:**
- Background: `colors.surfaceDisabled`
- Text: `colors.textDisabled`
- No hover effects
- Cursor: `not-allowed`
- No shadow

**Focus state:**
- Focus ring: `0 0 0 2px ${colors.surfaceRaised}, 0 0 0 4px ${colors.borderFocus}`
- Transition: `box-shadow 120ms ease-out`
- Only on keyboard focus (use `:focus-visible` or `onFocus` + check for keyboard)

### 2C. MetricBox Component

The metric cards that appear at the top of most pages.

Polish:
- Icon: 20px, positioned top-left, `colors.textTertiary`
- Value: `typography.fontSize.heading` (28px), `fontWeight.bold`, `colors.textPrimary`
- Label: `typography.fontSize.sm` (13px), `colors.textSecondary`, `marginTop: spacing[1]`
- Trend: Arrow icon (up/down) + percentage, colored by direction
- Hover: Card lifts, shadow deepens (use Card's hoverable prop)
- Click: Navigate to relevant detail page
- Height: Consistent across all cards (use `min-height: 120px`)
- Content: `display: flex`, `flexDirection: column`, `justifyContent: space-between`

### 2D. StatusTag / PriorityTag

Small pills that show status or priority.

Polish:
- Height: 24px
- Padding: `${spacing['1']} ${spacing['2.5']}` (4px 10px)
- Font: `typography.fontSize.label` (12px), `fontWeight.medium`
- Border radius: `borderRadius.full` (pill shape)
- Colors: Use `getStatusColor()` / `getPriorityColor()` from theme
- Background: The subtle variant (e.g., `statusActiveSubtle`)
- Text: The full variant (e.g., `statusActive`)
- Dot: Optional leading dot (6px circle, same color as text) for extra scanability
- Hover: Slightly increase background opacity (multiply by 1.5)
- Transition: `background ${duration.instant}ms ease-out`

### 2E. SectionHeader

Section headers that separate content areas:

```typescript
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;  // Button or link on the right
  count?: number;            // Item count badge
}
```

- Title: `typography.fontSize.title` (16px), `fontWeight.semibold`, `colors.textPrimary`
- Subtitle: `typography.fontSize.sm`, `colors.textTertiary`, `marginTop: spacing['0.5']`
- Count badge: Background `colors.surfaceInset`, `borderRadius.full`, `typography.fontSize.caption`, padding `2px 8px`
- Action: Right-aligned
- Margin bottom: `spacing[4]` (16px)
- Optional: Subtle bottom border `1px solid ${colors.borderSubtle}`

### 2F. Modal Component

Modals must animate and feel premium:

- Overlay: `colors.overlayScrim` (rgba(0,0,0,0.6)), animated fade
- Content: Centered, `max-width: 560px` (default), `borderRadius.xl`, `shadows.panel`
- Enter: Content scales from 0.96 to 1, opacity 0 to 1, slight Y shift
- Exit: Content scales to 0.98, opacity to 0 (faster than enter)
- Close button: Top-right corner, X icon, ghost style
- Header: `padding: ${spacing[6]} ${spacing[6]} ${spacing[4]}`, title in `fontSize.title`, `fontWeight.semibold`
- Body: `padding: 0 ${spacing[6]}`, scrollable if content overflows
- Footer: `padding: ${spacing[4]} ${spacing[6]} ${spacing[6]}`, right-aligned buttons
- Keyboard: Escape closes, focus trapped inside
- Body scroll: Locked when modal is open

### 2G. TabBar Component

Tab bars used across RFIs, Safety, Budget, etc.

- Container: `display: flex`, `gap: spacing[1]`, `border-bottom: 1px solid ${colors.borderSubtle}`
- Tab item: `padding: ${spacing[3]} ${spacing[4]}`, `fontSize.sm`, `fontWeight.medium`
- Default: `colors.textSecondary`
- Hover: `colors.textPrimary`, background `colors.surfaceHover`, `borderRadius.md` on top corners
- Active: `colors.primaryOrange`, `fontWeight.semibold`
- Active indicator: 2px bottom border, `colors.primaryOrange`
- **Animated indicator**: The bottom border should slide to the active tab position (track `left` and `width` of active tab, animate with CSS transition)
- Transition: `left 200ms cubic-bezier(0.32, 0.72, 0, 1), width 200ms cubic-bezier(0.32, 0.72, 0, 1)`

### 2H. Avatar Component

- Default: Circle with initials, colored background
- With image: Circle with `object-fit: cover`
- Sizes: `sm` (24px), `md` (32px), `lg` (40px), `xl` (48px)
- Border: `2px solid ${colors.surfaceRaised}` (for stacking)
- Hover: Slight scale (1.05), `shadows.sm`
- Status dot: Optional, 8px circle at bottom-right (green = online, gray = offline)
- Group: When multiple avatars stack, overlap by 8px with higher z-index on hover

### 2I. ProgressBar Component

- Height: `6px` (default), `4px` (compact), `8px` (large)
- Background (track): `colors.surfaceInset`
- Fill: `colors.primaryOrange` by default, or status color based on value
- Border radius: `borderRadius.full`
- Animation: Fill width transitions smoothly when value changes
- Threshold coloring: Optional. Green above 80%, amber 50-80%, red below 50%
- Transition: `width 500ms cubic-bezier(0.32, 0.72, 0, 1)`

### 2J. InputField Component

- Height: `touchTarget.min` (44px)
- Background: `colors.surfaceRaised`
- Border: `1px solid ${colors.borderDefault}`
- Focus border: `1px solid ${colors.borderFocus}`
- Focus ring: `0 0 0 3px ${colors.orangeSubtle}`
- Placeholder: `colors.textTertiary`
- Text: `typography.fontSize.body` (14px), `colors.textPrimary`
- Label: Above field, `typography.fontSize.label`, `fontWeight.medium`, `colors.textSecondary`, `marginBottom: spacing[1]`
- Error: Border `colors.statusCritical`, error message below in `colors.statusCritical`, `fontSize.label`
- Disabled: `background: colors.surfaceDisabled`, `cursor: not-allowed`, `opacity: 0.6`
- Transition: `border-color 120ms ease-out, box-shadow 120ms ease-out`

### 2K. EmptyState Component

When a page or section has no data:

```typescript
interface EmptyStateProps {
  icon: React.ReactNode;  // Lucide icon component
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

- Layout: Centered, vertical flex, `padding: ${spacing[16]} 0` (64px top/bottom)
- Icon: 48px, stroke-width 1.5, `colors.textTertiary`
- Title: `typography.fontSize.title`, `fontWeight.semibold`, `colors.textPrimary`, `marginTop: spacing[5]`
- Description: `typography.fontSize.sm`, `colors.textTertiary`, `marginTop: spacing[2]`, max-width 400px, text-align center
- Action: `Btn` variant `primary`, `marginTop: spacing[5]`

---

## Phase 3: React.memo Everything

### 3A. Components Missing React.memo

Currently only 7 of 24 components have `React.memo`. Add it to ALL:

- PageContainer
- Btn
- SectionHeader
- TableHeader
- Modal
- TabBar
- ProgressBar
- Dot
- AIRing
- InputField
- RelatedItems
- ToastProvider
- DetailPanel
- Skeleton
- EmptyState
- Tag

### 3B. Memo Strategy

For each component:
1. Wrap the export: `export const Card = React.memo(function Card(props: CardProps) { ... });`
2. Use named function (not arrow) inside memo for better DevTools names
3. For components receiving `children` or `style` props: Consider a custom comparison function only if profiling shows unnecessary re-renders
4. For components receiving `onClick`: The parent should memoize callbacks with `useCallback`

---

## Phase 4: TypeScript Cleanup

### 4A. Proper Interfaces

Every component must have a complete TypeScript interface. No `any` types. No implicit props.

Example:
```typescript
// Bad
export function Card({ children, ...props }) { ... }

// Good
interface CardProps {
  children: React.ReactNode;
  padding?: string;
  onClick?: () => void;
  hoverable?: boolean;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const Card = React.memo(function Card(props: CardProps) { ... });
```

### 4B. Eliminate `as any`

The codebase has 179 `as any` casts. While not all are in Primitives, fix any that are in these components. Common patterns:
- `style as any` → Properly type the style object
- `event as any` → Use `React.MouseEvent<HTMLElement>`
- `ref as any` → Use proper `React.Ref<HTMLElement>`

---

## Verification Checklist

- [ ] `Primitives.tsx` is deleted (or only re-exports from `primitives/`)
- [ ] Each of the 24 components lives in its own file in `src/components/primitives/`
- [ ] `index.ts` re-exports all components
- [ ] All imports across the codebase are updated (zero references to old path)
- [ ] Every component has `React.memo`
- [ ] Every component has a TypeScript interface for props
- [ ] Zero `as any` in any primitives file
- [ ] Card has hover lift animation
- [ ] Btn has all 5 variants, 3 sizes, loading, disabled, and focus states
- [ ] MetricBox has consistent height, hover, and click behavior
- [ ] Modal animates open and close
- [ ] TabBar has animated sliding indicator
- [ ] InputField has focus ring animation
- [ ] EmptyState is centered with icon, title, description, and action
- [ ] All primitives use theme tokens exclusively (zero hardcoded values)
- [ ] App compiles and runs without errors after migration
