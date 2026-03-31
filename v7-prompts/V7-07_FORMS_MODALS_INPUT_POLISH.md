# V7-07: Forms, Modals & Input Polish

## Goal
Make every form, modal, dropdown, and input field feel like Apple's best: clean fields with perfect typography, smooth focus transitions, clear validation, and elegant submit flows. Forms are how users CREATE data. They must be frictionless and beautiful.

## Why This Matters
SiteSync has 17 form modals plus inline editing across multiple pages. The forms are rated 8.5/10 but need to reach 10/10. The gaps: inconsistent input heights, missing focus ring animations, validation errors that appear abruptly, and submit buttons that don't communicate loading state. Every form is a moment where the user decides to invest time in the product. That moment must feel premium.

---

## Phase 1: Input Field Perfection

### 1A. Text Input Base

Every text input in the app must follow this exact specification:

```typescript
// Base input
{
  width: '100%',
  height: touchTarget.min,         // 44px — accessible touch target
  padding: `0 ${spacing[3]}`,     // 0 12px
  fontSize: typography.fontSize.body,  // 14px
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.normal,
  color: colors.textPrimary,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,   // 8px
  outline: 'none',
  transition: `border-color 120ms ease-out, box-shadow 120ms ease-out`,
}

// Placeholder
{
  color: colors.textTertiary,
}

// Hover (not focused)
{
  borderColor: colors.borderHover || '#D5D0CA',
}

// Focus
{
  borderColor: colors.borderFocus,  // primaryOrange
  boxShadow: `0 0 0 3px ${colors.orangeSubtle}`,  // Soft orange glow
}

// Error
{
  borderColor: colors.statusCritical,
  boxShadow: `0 0 0 3px ${colors.statusCriticalSubtle}`,
}

// Disabled
{
  background: colors.surfaceInset,
  color: colors.textTertiary,
  cursor: 'not-allowed',
  opacity: 0.6,
}
```

### 1B. Label

```typescript
{
  display: 'block',
  fontSize: typography.fontSize.label,   // 12px
  fontWeight: typography.fontWeight.medium,  // 500
  color: colors.textSecondary,
  marginBottom: spacing['1.5'],         // 6px
  letterSpacing: typography.letterSpacing.normal,
}
```

Optional: Required indicator — small asterisk in `colors.statusCritical` after label text.

### 1C. Helper Text

Below the input, optional helper or error text:

```typescript
// Helper text (default)
{
  fontSize: typography.fontSize.caption,  // 11px
  color: colors.textTertiary,
  marginTop: spacing[1],                // 4px
}

// Error text
{
  fontSize: typography.fontSize.caption,
  color: colors.statusCritical,
  marginTop: spacing[1],
}
```

Error text should animate in: Fade + slide down 4px, `duration.fast`.

### 1D. Select / Dropdown Input

Same height and border as text input, with:
- Chevron-down icon on the right, 16px, `colors.textTertiary`
- On open: Chevron rotates 180deg (animated)
- Dropdown menu: `shadows.dropdown`, `borderRadius.md`, `border: 1px solid ${colors.borderSubtle}`
- Dropdown items: 40px height, `padding: 0 ${spacing[3]}`, hover: `background: colors.surfaceHover`
- Active item: `background: colors.orangeSubtle`, `color: colors.primaryOrange`, checkmark icon on right
- Dropdown animation: Scale from 0.95, fade in, transform-origin top

### 1E. Textarea

Same styling as text input but:
- `min-height: 100px`
- `padding: ${spacing[3]}` (12px all sides)
- `resize: vertical` (user can resize vertically only)
- Auto-grow: Textarea height grows with content (up to max-height)
- Character count (optional): Bottom-right, `fontSize.caption`, `colors.textTertiary`

### 1F. Checkbox

```typescript
// Checkbox
{
  width: '18px',
  height: '18px',
  borderRadius: borderRadius.sm,      // 4px
  border: `2px solid ${colors.borderDefault}`,
  background: colors.surfaceRaised,
  cursor: 'pointer',
  transition: `all ${duration.fast}ms ${easing.spring}`,
}

// Checked
{
  background: colors.primaryOrange,
  borderColor: colors.primaryOrange,
  // White checkmark icon centered inside
}

// Focus
{
  boxShadow: `0 0 0 3px ${colors.orangeSubtle}`,
}
```

Animation: Check appears with a small scale-in (0.8 to 1) with spring easing.

### 1G. Radio Button

```typescript
{
  width: '18px',
  height: '18px',
  borderRadius: borderRadius.full,
  border: `2px solid ${colors.borderDefault}`,
  background: colors.surfaceRaised,
  cursor: 'pointer',
  transition: `all ${duration.fast}ms ${easing.spring}`,
}

// Selected: Inner circle (10px, orange) appears with scale animation
```

### 1H. Toggle / Switch

```typescript
// Track
{
  width: '36px',
  height: '20px',
  borderRadius: borderRadius.full,
  background: colors.borderDefault,  // off state
  // background: colors.primaryOrange,  // on state
  transition: `background ${duration.fast}ms ease-out`,
  cursor: 'pointer',
}

// Thumb
{
  width: '16px',
  height: '16px',
  borderRadius: borderRadius.full,
  background: colors.white,
  boxShadow: shadows.sm,
  transform: 'translateX(2px)',       // off position
  // transform: 'translateX(18px)',    // on position
  transition: `transform ${duration.fast}ms ${easing.spring}`,
}
```

### 1I. Date Picker

- Input: Same as text input with calendar icon on right
- Calendar popup: `shadows.dropdown`, `borderRadius.lg`
- Month header: Navigation arrows + month/year text
- Day grid: 7 columns, each day 36px cell
- Today: Orange outline ring
- Selected: Filled orange circle
- Range selection: Light orange fill between dates
- Hover: `surfaceHover` background
- Animation: Popup scales in like dropdown

### 1J. File Upload Zone

```typescript
// Drop zone
{
  border: `2px dashed ${colors.borderDefault}`,
  borderRadius: borderRadius.xl,
  padding: `${spacing[8]} ${spacing[6]}`,
  textAlign: 'center',
  cursor: 'pointer',
  transition: `all ${duration.normal}ms ease-out`,
}

// Hover / drag over
{
  borderColor: colors.primaryOrange,
  background: colors.orangeSubtle,
}
```

- Icon: Upload cloud, 40px, `colors.textTertiary`
- Text: "Drop files here or click to browse"
- Accepted formats: Small text below
- After upload: File list with name, size, remove button, progress bar

---

## Phase 2: Form Layout

### 2A. Two-Column Form Layout

For larger forms (EntityFormModal), use a two-column layout:

```
┌──────────────────────────────────────────────┐
│  Form Title                          [Close] │
├──────────────────────────────────────────────┤
│                                              │
│  [Label]            [Label]                  │
│  [Input Field]      [Input Field]            │
│                                              │
│  [Label]            [Label]                  │
│  [Select]           [Date Picker]            │
│                                              │
│  [Label]                                     │
│  [Textarea - full width]                     │
│                                              │
├──────────────────────────────────────────────┤
│                     [Cancel]  [Submit]        │
└──────────────────────────────────────────────┘
```

- Grid: `display: grid`, `gridTemplateColumns: '1fr 1fr'`, `gap: ${spacing[5]} ${spacing[4]}`
- Full-width fields: `gridColumn: '1 / -1'`
- Section dividers: Subtle `borderTop: 1px solid ${colors.borderSubtle}`, `paddingTop: spacing[5]`

### 2B. Form Section Headers

For long forms with sections:
```typescript
{
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textPrimary,
  marginBottom: spacing[3],
  paddingBottom: spacing[2],
  borderBottom: `1px solid ${colors.borderSubtle}`,
}
```

### 2C. Field Spacing

- Between fields: `spacing[5]` (20px)
- Between label and input: `spacing['1.5']` (6px)
- Between input and helper/error text: `spacing[1]` (4px)
- Between sections: `spacing[8]` (32px)

---

## Phase 3: Modal Polish

### 3A. Modal Sizes

Define 3 modal sizes:
- `sm`: `max-width: 420px` (confirmations, simple forms)
- `md`: `max-width: 560px` (standard forms, details)
- `lg`: `max-width: 720px` (complex forms, multi-section)
- `xl`: `max-width: 900px` (full editors, drawing viewers)

### 3B. Modal Anatomy

```typescript
// Overlay
{
  position: 'fixed',
  inset: 0,
  background: colors.overlayScrim,  // rgba(0,0,0,0.6)
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: zIndex.modal,
  padding: spacing[6],
}

// Content container
{
  background: colors.surfaceRaised,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  width: '100%',
  maxWidth: '560px',  // or size variant
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

// Header
{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[5]} ${spacing[6]}`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  flexShrink: 0,
}

// Header title
{
  fontSize: typography.fontSize.title,  // 16px
  fontWeight: typography.fontWeight.semibold,
  color: colors.textPrimary,
}

// Body
{
  padding: `${spacing[5]} ${spacing[6]}`,
  overflowY: 'auto',
  flex: 1,
}

// Footer
{
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[3],
  padding: `${spacing[4]} ${spacing[6]}`,
  borderTop: `1px solid ${colors.borderSubtle}`,
  flexShrink: 0,
}
```

### 3C. Modal Animation (Framer Motion)

```typescript
// Overlay
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.2 }}

// Content
initial={{ opacity: 0, scale: 0.96, y: 10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.98, y: 5 }}
transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
```

### 3D. Modal Close Behavior

- Click overlay: Close (with confirmation if form is dirty)
- Press Escape: Close
- Close button: X icon, top-right, ghost button style
- Dirty form warning: "You have unsaved changes. Discard?" with Cancel/Discard buttons

### 3E. Confirmation Dialogs

Special small modal for destructive actions:
- Size: `sm` (420px)
- Icon: Warning triangle, 48px, `colors.statusCritical`
- Title: "Delete this RFI?" in `fontSize.title`, `fontWeight.semibold`
- Description: Explains what happens, in `fontSize.body`, `colors.textSecondary`
- Buttons: Cancel (secondary) + Destructive action (danger variant Btn)
- No close button (force choice)

---

## Phase 4: Form Validation UX

### 4A. Inline Validation

- Validate on blur (not on every keystroke)
- Error text slides in below the field with animation
- Error border: Transition from `borderDefault` to `statusCritical` in 120ms
- Error icon: Small alert-circle, 14px, inside the input on the right

### 4B. Submit Validation

When user clicks Submit with errors:
1. Scroll to first error field
2. Focus the first error field
3. All error fields show their error state simultaneously
4. Submit button shakes briefly (using CSS animation: translateX -4px, 4px, -2px, 2px, 0) for 400ms
5. Error summary toast (optional): "Please fix 3 errors before submitting"

### 4C. Success State

After successful form submission:
1. Submit button shows checkmark icon briefly (green, 500ms)
2. Modal closes with exit animation
3. Toast notification: "RFI #048 created successfully"
4. If table view: New row highlights with `surfaceSelected` background for 2 seconds

### 4D. Loading State During Submit

When form is submitting:
1. Submit button: Text replaced with spinner, button disabled, `cursor: wait`
2. All form fields: `pointer-events: none`, subtle opacity reduction (0.7)
3. Cancel button: Still active (user can abort)
4. If submit takes >3 seconds: Show progress text "Saving..."

---

## Phase 5: Dropdown/Popover Polish

### 5A. Dropdown Menu

```typescript
{
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.lg,
  boxShadow: shadows.dropdown,
  padding: `${spacing[1]} 0`,
  minWidth: '180px',
  zIndex: zIndex.dropdown,
}
```

- Item height: 36px
- Item padding: `0 ${spacing[3]}`
- Item hover: `background: colors.surfaceHover`
- Item active: `background: colors.surfaceSelected`
- Divider: `1px solid ${colors.borderSubtle}`, `margin: ${spacing[1]} 0`
- Icon in item: 16px, `colors.textTertiary`, `margin-right: spacing[2]`
- Destructive item: `color: colors.statusCritical`

Animation:
```typescript
initial={{ opacity: 0, scale: 0.95, y: -4 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95 }}
transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
```

### 5B. Context Menu

Right-click context menus: Same as dropdown but positioned at cursor location.

### 5C. Tooltip

```typescript
{
  background: colors.textPrimary,  // Dark
  color: colors.textOnDark,
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.medium,
  padding: `${spacing['1.5']} ${spacing[2]}`,
  borderRadius: borderRadius.base,
  boxShadow: shadows.dropdown,
  maxWidth: '200px',
  zIndex: zIndex.tooltip,
}
```

- Arrow: 6px triangle pointing to trigger
- Delay: 300ms before appearing (no instant flash)
- Animation: Fade + scale from 0.96

---

## Verification Checklist

- [ ] Every text input is 44px tall with consistent border/focus/error states
- [ ] Focus ring animates in (not instant snap)
- [ ] Error text slides in below fields with animation
- [ ] All checkboxes animate when checked (spring scale)
- [ ] All toggles have smooth thumb slide
- [ ] Select dropdowns have chevron rotation and popup animation
- [ ] Modals animate open (scale + fade) and close (reverse)
- [ ] Modals have sticky header/footer with scrollable body
- [ ] Confirmation dialogs use danger button variant
- [ ] Form validation happens on blur, not keystroke
- [ ] Submit button shakes on validation failure
- [ ] Submit button shows spinner during save
- [ ] Success state shows checkmark + toast
- [ ] Dirty form shows discard warning on close
- [ ] Dropdown menus scale in with shadow
- [ ] Tooltips appear after 300ms delay with fade
- [ ] All inputs use theme tokens exclusively
- [ ] Field spacing is consistent (20px between fields, 6px label-to-input)
