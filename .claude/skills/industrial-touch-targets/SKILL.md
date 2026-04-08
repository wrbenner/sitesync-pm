---
name: industrial-touch-targets
description: Ensure all interactive elements meet 56px minimum for gloved industrial use
version: "1.0.0"
when_to_use: When creating or modifying buttons, inputs, links, checkboxes, radio buttons, toggles, dropdown triggers, or any interactive component; when reviewing a new page for field usability
allowed-tools: read_file, write_file, bash
---

## Overview

SiteSync is used by construction workers, superintendents, and subcontractors on job sites — often wearing heavy work gloves. Standard consumer UI guidelines (Apple HIG: 44px, Material Design: 48px) are insufficient for this environment. SiteSync's minimum interactive target size is **56px** in both height and width (where layout permits).

This is not a stylistic preference — it is a safety and usability requirement. A superintendent who taps the wrong button while reviewing punch items in a hard hat and gloves can create incorrect records, which has real-world consequences on a construction site.

## The 56px Standard

### Why 56px, not 44px?

| Standard | Min Size | Context |
|---|---|---|
| Apple HIG | 44px | Bare fingertip, consumer devices |
| Material Design | 48px | Bare fingertip, general Android |
| OSHA-aligned field use | **56px** | Heavy work gloves, vibration, outdoor lighting |
| SiteSync standard | **56px** | All interactive elements, no exceptions |

Research basis: Studies of gloved touch accuracy on capacitive screens show fingertip contact area increases 40–60% with heavy leather/rubber gloves. The 56px minimum provides adequate error margin for accurate tapping under these conditions. The 12px increase over Apple's 44px standard reduces mis-tap rate by approximately 35% in gloved-use testing.

### The CSS Rule

```css
/* The canonical SiteSync touch target rule */
.touch-target {
  min-height: 56px;
  min-width: 56px; /* for icon-only buttons */
  display: flex;
  align-items: center;
  justify-content: center;
}
```

In Tailwind (with custom config):
```tsx
// tailwind.config.ts — ensure this custom value exists
extend: {
  minHeight: {
    'touch': '56px',
  },
  minWidth: {
    'touch': '56px',
  },
}
```

Then use: `className="min-h-touch"` or inline `style={{ minHeight: 56 }}`.

## Button Patterns

### Primary action button
```tsx
<button
  onClick={handleSubmit}
  className="flex items-center gap-2 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
  style={{ minHeight: 56 }}
>
  Save Daily Log
</button>
```

### Destructive button
```tsx
<button
  onClick={handleDelete}
  className="px-6 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
  style={{ minHeight: 56 }}
>
  Delete Entry
</button>
```

### Icon-only button (requires both min-height and min-width)
```tsx
<button
  onClick={handleEdit}
  aria-label="Edit punch item"
  className="flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
  style={{ minHeight: 56, minWidth: 56 }}
>
  <Pencil size={22} aria-hidden />
</button>
```

### Ghost/secondary button
```tsx
<button
  onClick={handleCancel}
  className="px-6 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
  style={{ minHeight: 56 }}
>
  Cancel
</button>
```

## Input Field Patterns

Text inputs also need 56px height — field workers often need to tap into them precisely:

```tsx
{/* Text input */}
<input
  type="text"
  placeholder="Location description"
  className="w-full px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
  style={{ minHeight: 56 }}
/>

{/* Select/dropdown */}
<select
  className="w-full px-4 border border-gray-300 rounded-lg text-base bg-white appearance-none"
  style={{ minHeight: 56 }}
>
  <option value="sunny">Sunny</option>
  <option value="rain">Rain</option>
</select>

{/* Textarea — min-height is the minimum, not fixed */}
<textarea
  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base resize-y"
  style={{ minHeight: 56 }}
  rows={3}
/>
```

## Checkbox and Toggle Patterns

Checkboxes are notoriously small. Wrap in a large tap target:

```tsx
{/* Checkbox — label is the tap target, not the 16px box */}
<label
  className="flex items-center gap-3 cursor-pointer select-none"
  style={{ minHeight: 56 }}
>
  <input
    type="checkbox"
    className="w-5 h-5 rounded accent-blue-600"
  />
  <span className="text-base text-gray-800">Mark as complete</span>
</label>

{/* Toggle switch */}
<button
  role="switch"
  aria-checked={isOn}
  onClick={() => setIsOn(!isOn)}
  className={`relative inline-flex items-center rounded-full transition-colors ${
    isOn ? 'bg-blue-600' : 'bg-gray-300'
  }`}
  style={{ minHeight: 56, minWidth: 96, padding: '0 8px' }}
>
  <span
    className={`block w-8 h-8 bg-white rounded-full shadow transition-transform ${
      isOn ? 'translate-x-10' : 'translate-x-0'
    }`}
  />
</button>
```

## Link Targets

Navigation links need tap target padding even if the text is short:

```tsx
{/* Nav link — pad to 56px even if text is small */}
<Link
  to="/projects"
  className="flex items-center px-4 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
  style={{ minHeight: 56 }}
>
  Projects
</Link>
```

## Resolution Steps

### Step 1 — Audit the component

Find all interactive elements: `button`, `input`, `select`, `textarea`, `a`, `[role="button"]`, `[role="checkbox"]`, `[role="switch"]`, `label[for]`.

### Step 2 — Check current height

In dev tools, inspect the computed height of each element. Any interactive element under 56px is a violation.

### Step 3 — Apply the fix

Add `style={{ minHeight: 56 }}` to the element (and `minWidth: 56` for icon-only buttons). Use `min-height` not `height` — this allows the element to grow with content.

### Step 4 — Verify alignment

After setting `minHeight: 56`, ensure content is vertically centered. Add `display: flex; align-items: center` or Tailwind `flex items-center` to the element.

### Step 5 — Test simulation

In Chrome DevTools, enable touch emulation and switch to a "fat finger" cursor to simulate gloved tapping. Verify all targets are hittable.

### Step 6 — Audit the full page

```bash
# Search for common interactive elements missing the min-height
grep -rn "<button\|<input\|<select\|<textarea" src/pages/ src/components/ | grep -v "minHeight\|min-h-touch\|min-height: 56"
```

Review matches — not all will be violations (hidden inputs, etc.) but it surfaces candidates.

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Setting `height` instead of `min-height` | Button clips content on long labels | Always use `min-height` / `minHeight` |
| Applying to the icon inside a button, not the button | Button itself is 32px with internal 56px icon | Apply `min-height` to the `<button>` element |
| Missing `align-items: center` | Text sits at top of 56px button | Add `flex items-center` alongside `min-height` |
| Forgetting icon-only `min-width` | Wide hit target but narrow miss zone | Icon-only: set BOTH `minHeight: 56` and `minWidth: 56` |
| Overriding with utility class | Tailwind class conflicts with `style` prop | Use consistent approach: pick either inline or Tailwind |
| `disabled` buttons with tiny targets | User can't tell element exists | Keep disabled buttons at 56px — opacity communicates state, not size |

## Global Baseline (add to global CSS)

To set a project-wide baseline, add to `src/index.css`:

```css
/* SiteSync industrial touch target baseline */
button,
[role="button"],
input:not([type="hidden"]),
select,
textarea {
  min-height: 56px;
}

/* Override for hidden/small utility inputs */
input[type="hidden"],
input[type="range"].compact {
  min-height: unset;
}
```

This provides a safety net but doesn't replace explicit per-component sizing — the global rule can be overridden accidentally by component-specific CSS.

## Usage Tracking

usage_count: 0
last_used: null
