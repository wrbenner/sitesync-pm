# V7-09: Typography & Visual Hierarchy

## Goal
Establish a rigorous typographic system that creates clear visual hierarchy on every page. Every piece of text must have a defined role, size, weight, and color. No ambiguity. No two elements fighting for attention. The eye should flow naturally from most important to least important.

## Why This Matters
Typography is 90% of UI design. Construction PMs scan pages quickly between meetings and field visits. If the visual hierarchy is unclear, they waste time finding what matters. Apple's design language works because every element has exactly one level of emphasis. SiteSync currently mixes font sizes inconsistently, has widget headers all at the same tiny size, and doesn't differentiate heading levels enough. This creates a flat, confusing visual hierarchy.

---

## Phase 1: Type Scale Audit

### 1A. The Type Scale

The existing scale from `theme.ts` (keep these, they're well chosen):

| Token | Size | Use Case |
|-------|------|----------|
| `display` | 36px | Marketing pages, onboarding. Rarely used in app. |
| `heading` | 28px | Page titles (Dashboard, RFIs, Budget) |
| `subtitle` | 18px | Section headings, card titles |
| `title` | 16px | Widget headers, dialog titles, form section headers |
| `body` | 14px | Primary text, paragraphs, table cells |
| `sm` | 13px | Secondary information, descriptions, sidebar nav |
| `label` | 12px | Labels, column headers, metadata |
| `caption` | 11px | Timestamps, helper text, fine print |

### 1B. Weight Assignments

Each hierarchy level has a fixed weight:

| Level | Weight | Token |
|-------|--------|-------|
| Page title | 700 | `bold` |
| Section heading | 600 | `semibold` |
| Widget/card header | 600 | `semibold` |
| Body text | 400 | `normal` |
| Secondary text | 400 | `normal` |
| Labels | 500 | `medium` |
| Navigation | 400 (inactive), 500 (active) | `normal` / `medium` |
| Metrics/numbers | 700 | `bold` |
| Buttons | 500 | `medium` |

### 1C. Color Assignments

| Level | Color | Token |
|-------|-------|-------|
| Primary content | `#1A1613` | `textPrimary` |
| Secondary content | `#5C5550` | `textSecondary` |
| Tertiary/metadata | `#9A9490` | `textTertiary` |
| Interactive/links | `#F47820` | `primaryOrange` (or `orangeText` for AA compliance) |
| Disabled | `#C5C0BB` | `textDisabled` |
| On dark backgrounds | `rgba(255,255,255,0.92)` | `textOnDark` |

---

## Phase 2: Page Title Consistency

### 2A. Every Page Must Have a Title

Pattern:
```typescript
<div style={{
  marginBottom: spacing[6],  // 24px below title
}}>
  <h1 style={{
    fontSize: typography.fontSize.heading,    // 28px
    fontWeight: typography.fontWeight.bold,   // 700
    color: colors.textPrimary,
    letterSpacing: typography.letterSpacing.tight,  // -0.02em
    lineHeight: typography.lineHeight.tight,  // 1.2
    margin: 0,
  }}>
    RFIs
  </h1>
  {/* Optional subtitle */}
  <p style={{
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing[1],
  }}>
    Track and manage all requests for information
  </p>
</div>
```

### 2B. Title with Actions

When the page title has action buttons:
```typescript
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: spacing[6],
}}>
  <div>
    <h1 style={pageTitleStyle}>RFIs</h1>
    <p style={pageSubtitleStyle}>Track and manage all requests for information</p>
  </div>
  <div style={{ display: 'flex', gap: spacing[3] }}>
    <Btn variant="secondary" icon={<Download />}>Export</Btn>
    <Btn variant="primary" icon={<Plus />}>Create RFI</Btn>
  </div>
</div>
```

### 2C. Title with Count

For pages showing a collection:
```typescript
<h1 style={pageTitleStyle}>
  RFIs
  <span style={{
    fontSize: typography.fontSize.title,    // 16px (smaller than heading)
    fontWeight: typography.fontWeight.normal,
    color: colors.textTertiary,
    marginLeft: spacing[2],
  }}>
    247
  </span>
</h1>
```

---

## Phase 3: Content Hierarchy Rules

### 3A. The 3-Level Rule

Every page section should have at most 3 levels of text hierarchy:

1. **Header**: The title of the section (title or subtitle size, semibold)
2. **Content**: The main information (body size, normal weight)
3. **Meta**: Supporting details (label or caption size, tertiary color)

Example in a table row:
- Level 1: "RFI #047 — Structural beam sizing" (body, medium weight, textPrimary)
- Level 2: "Assigned to Mike Torres, Turner Construction" (sm, normal, textSecondary)
- Level 3: "Created 2h ago" (caption, normal, textTertiary)

### 3B. Metrics/Numbers

Large numbers should be the most visually prominent element on metric cards:
- Value: `heading` size (28px), `bold`, `textPrimary`
- If value is a dollar amount or percentage, use `fontFamilyMono` for alignment
- Trend arrows: `label` size, colored by direction

### 3C. Widget Headers

Widget headers in Dashboard and detail panels:
- Text: `sm` size (13px), `semibold`, `textPrimary`
- Letter spacing: `wide` (0.01em)
- Text transform: `uppercase` — this differentiates headers from body content and is used by Linear, Notion, and Stripe
- Icon: 16px, `textTertiary`, before the text

### 3D. Column Headers (Tables)

Table column headers:
- Text: `caption` size (11px), `semibold`, `textTertiary`
- Letter spacing: `wider` (0.04em)
- Text transform: `uppercase`
- This is the lightest/smallest header level, appropriate for repeated structural elements

---

## Phase 4: Spacing Rhythm

### 4A. Vertical Spacing Scale

The spacing between text elements must follow a consistent rhythm:

| Relationship | Spacing |
|-------------|---------|
| Page title → Metric cards | `spacing[6]` (24px) |
| Metric cards → Main content | `spacing[6]` (24px) |
| Section header → Section content | `spacing[4]` (16px) |
| Content block → Content block | `spacing[5]` (20px) |
| Label → Input | `spacing['1.5']` (6px) |
| Input → Helper text | `spacing[1]` (4px) |
| Paragraph → Paragraph | `spacing[4]` (16px) |
| List item → List item | `spacing[2]` (8px) |

### 4B. Horizontal Spacing

| Relationship | Spacing |
|-------------|---------|
| Page content left/right padding | `spacing[9]` (36px, from `layout.contentPaddingX`) |
| Card internal padding | `spacing[5]` (20px) |
| Card → Card gap | `spacing[4]` (16px) |
| Icon → Text gap | `spacing[2]` (8px) for inline, `spacing[3]` (12px) for nav items |
| Button → Button gap | `spacing[3]` (12px) |

### 4C. Content Max Width

Text content should never stretch beyond readable widths:
- Body text max-width: `640px` (prevents eye tracking fatigue)
- Full-width tables and charts are fine (data density is expected)
- Description text in detail panels: Constrain to ~60ch for readability

---

## Phase 5: Line Height & Letter Spacing

### 5A. Line Height Rules

| Text Type | Line Height |
|-----------|-------------|
| Headings (28px+) | `tight` (1.2) |
| Subtitles (16-18px) | `snug` (1.35) |
| Body text (13-14px) | `normal` (1.55) |
| Labels/captions (11-12px) | `normal` (1.55) |
| Single-line (buttons, nav) | `none` (1) or `tight` (1.2) |

### 5B. Letter Spacing Rules

| Text Type | Letter Spacing |
|-----------|---------------|
| Large headings (28px+) | `tight` (-0.02em) |
| Medium headings (16-18px) | `normal` (-0.011em) |
| Body text | `normal` (-0.011em) |
| Uppercase labels/headers | `wider` (0.04em) or `widest` (0.08em) |
| Buttons | `normal` (-0.011em) |
| Monospace (IDs, amounts) | `normal` (0) |

---

## Phase 6: Special Typography

### 6A. Monospace Usage

Use `fontFamilyMono` for:
- RFI/Submittal/Task IDs: `#047`, `SUB-012`
- Dollar amounts in tables: `$1,234.56`
- Timestamps with precision: `14:32:07`
- Code/technical values: API keys, file sizes
- Make monospace slightly smaller than surrounding text (reduce by 1px) to maintain visual weight

### 6B. Truncation

When text overflows its container:
- Single line: `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap`
- Multi line: Use `-webkit-line-clamp` with 2 or 3 lines max
- Always: Provide a tooltip on hover showing the full text

### 6C. Status and Priority Text

- Status tags: `label` size (12px), `medium` weight, colored background
- Priority: Same as status
- Never use all-caps for status text in body content (only in column headers)
- Title case: "In Progress", "Under Review", "At Risk"

### 6D. Accessibility Contrast

All text must meet WCAG AA contrast ratios:
- `textPrimary` (#1A1613) on white: 16:1 ✓
- `textSecondary` (#5C5550) on white: 7.2:1 ✓
- `textTertiary` (#9A9490) on white: 3.1:1 — Use only for non-essential metadata
- `primaryOrange` (#F47820) on white: 3.4:1 — Use `orangeText` (#C45A0C, 5.5:1) for text
- **CRITICAL:** Never use `primaryOrange` as text color for anything smaller than 18px. Use `orangeText` instead.

---

## Phase 7: Responsive Typography

### 7A. Mobile Adjustments

On screens < `768px`:
- Page title: Reduce from 28px to 24px
- Subtitle: Reduce from 18px to 16px
- Body: Keep at 14px (don't reduce body text)
- Caption: Keep at 11px

### 7B. Dense Mode (Optional)

For power users who want more data density:
- Reduce all spacing by one step (spacing[5] → spacing[4])
- Reduce body to 13px
- Reduce row heights to 44px
- Add a toggle in settings

---

## Verification Checklist

- [ ] Every page has a heading in 28px bold
- [ ] Section headers are 16-18px semibold
- [ ] Widget headers are 13px semibold uppercase
- [ ] Column headers are 11px semibold uppercase with wide tracking
- [ ] Body text is 14px normal weight
- [ ] Secondary text is 13px in textSecondary
- [ ] Metadata is 11-12px in textTertiary
- [ ] Metric values are 28px bold
- [ ] No font size exists in code that isn't from the type scale
- [ ] No font weight exists in code that isn't from the weight scale
- [ ] All orange text uses `orangeText` (#C45A0C) not `primaryOrange` for AA compliance
- [ ] Line heights follow the rules (tight for headings, normal for body)
- [ ] Letter spacing uses `tight` for headings, `wider`/`widest` for uppercase
- [ ] Monospace is used for IDs, dollar amounts, and code
- [ ] Long text is truncated with ellipsis and hover tooltip
- [ ] Vertical spacing rhythm is consistent across all pages
- [ ] Content max-width prevents overly long lines
