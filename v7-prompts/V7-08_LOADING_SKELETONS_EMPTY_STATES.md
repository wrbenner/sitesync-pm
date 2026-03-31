# V7-08: Loading States, Skeletons & Empty States

## Goal
Ensure every single page and component in SiteSync has three states: loading, empty, and populated. Loading states use shimmer skeletons that match content shapes. Empty states are beautiful and actionable. No spinner wheels. No blank screens. No "Loading..." text. Ever.

## Why This Matters
The fastest way to make an app feel cheap is to show a blank page while data loads. Apple, Linear, and Notion all use skeleton screens that give users a preview of the page structure before content arrives. This creates perceived speed even when the actual load time hasn't changed. An app without loading states feels broken. An app with great loading states feels fast.

---

## Phase 1: Skeleton System

### 1A. Skeleton Base Component

Create `src/components/primitives/Skeleton.tsx` (already exists but needs enhancement):

```typescript
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
  variant?: 'text' | 'circle' | 'rect';
}

const Skeleton = React.memo(function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius: br = borderRadius.base,
  variant = 'rect',
  style,
}: SkeletonProps) {
  const resolvedRadius = variant === 'circle' ? borderRadius.full : br;
  const resolvedWidth = variant === 'circle' ? height : width;

  return (
    <div
      aria-hidden="true"
      style={{
        width: resolvedWidth,
        height,
        borderRadius: resolvedRadius,
        background: `linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 50%, ${colors.surfaceInset} 75%)`,
        backgroundSize: '800px 100%',
        animation: 'shimmer 1.5s linear infinite',
        ...style,
      }}
    />
  );
});
```

### 1B. Composite Skeleton Components

Create pre-built skeleton shapes for common patterns:

**SkeletonMetricCard:**
```typescript
function SkeletonMetricCard() {
  return (
    <Card padding={spacing[5]} style={{ minHeight: '120px' }}>
      <Skeleton width="20px" height="20px" borderRadius={borderRadius.sm} />
      <div style={{ marginTop: spacing[4] }}>
        <Skeleton width="80px" height="28px" /> {/* Value */}
      </div>
      <div style={{ marginTop: spacing[2] }}>
        <Skeleton width="120px" height="12px" /> {/* Label */}
      </div>
    </Card>
  );
}
```

**SkeletonTableRow:**
```typescript
function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  const widths = ['30%', '20%', '15%', '20%', '15%'].slice(0, columns);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing[4],
      padding: `0 ${spacing[5]}`,
      height: '52px',
      borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} height="14px" />
      ))}
    </div>
  );
}
```

**SkeletonActivityItem:**
```typescript
function SkeletonActivityItem() {
  return (
    <div style={{
      display: 'flex',
      gap: spacing[3],
      padding: `${spacing[4]} ${spacing[5]}`,
      borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <Skeleton variant="circle" height="32px" /> {/* Avatar */}
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height="14px" />
        <Skeleton width="30%" height="11px" style={{ marginTop: spacing[2] }} />
      </div>
    </div>
  );
}
```

**SkeletonChart:**
```typescript
function SkeletonChart({ height = '200px' }: { height?: string }) {
  return (
    <Skeleton width="100%" height={height} borderRadius={borderRadius.md} />
  );
}
```

**SkeletonKanbanColumn:**
```typescript
function SkeletonKanbanColumn() {
  return (
    <div style={{ width: '280px', flexShrink: 0 }}>
      <Skeleton width="120px" height="16px" style={{ marginBottom: spacing[3] }} />
      {[1, 2, 3].map(i => (
        <Skeleton
          key={i}
          width="100%"
          height="100px"
          borderRadius={borderRadius.lg}
          style={{ marginBottom: spacing[3] }}
        />
      ))}
    </div>
  );
}
```

### 1C. Staggered Skeleton Animation

When showing multiple skeletons, stagger their shimmer animation slightly so they don't all pulse in sync (which looks robotic):

```typescript
// Add animation-delay based on index
<Skeleton style={{ animationDelay: `${index * 80}ms` }} />
```

---

## Phase 2: Page-Level Loading States

Every page must have a loading skeleton that matches its layout. Implement a `<PageSkeleton>` for each page:

### 2A. Dashboard Loading

```
┌─────────────────────────────────────────────┐
│  [████ Hero Bar Skeleton ██████████████████] │
├──────┬──────┬──────┬──────┬──────┤
│[████]│[████]│[████]│[████]│[████]│  ← 5 MetricCard skeletons
├──────┴──────┴──────┴──────┴──────┤
│                                              │
│  ┌─────────────────┐  ┌──────────┐          │
│  │ Activity Skel   │  │ Weather  │          │
│  │ ████████████    │  │ ████     │          │
│  │ ████████        │  │ ████     │          │
│  └─────────────────┘  └──────────┘          │
└──────────────────────────────────────────────┘
```

### 2B. Table Page Loading (RFIs, Submittals, PunchList, etc.)

```
┌──────────────────────────────────────────────┐
│  [████]  [████]  [████]  [████]  [████]      │  ← MetricCard skeletons
├──────────────────────────────────────────────┤
│  [████ Filter bar skeleton ████████████████]  │
├──────────────────────────────────────────────┤
│  Header Row (real, not skeleton)             │
├──────────────────────────────────────────────┤
│  [████████  ████  ████  ████  ████]          │  ← Row skeleton 1
│  [████████  ████  ████  ████  ████]          │  ← Row skeleton 2
│  [████████  ████  ████  ████  ████]          │  ← Row skeleton 3
│  [████████  ████  ████  ████  ████]          │  ← Row skeleton 4
│  [████████  ████  ████  ████  ████]          │  ← Row skeleton 5
└──────────────────────────────────────────────┘
```

### 2C. Detail View Loading

When opening a detail panel/page:
```
┌──────────────────────────────────────────────┐
│  [████ Title Skeleton ██████████]   [Close]  │
├──────────────────────────────────────────────┤
│  [████]  [████]                              │  ← Status/Priority tags
│                                              │
│  [████████████████████████]                  │  ← Description line 1
│  [██████████████]                            │  ← Description line 2
│                                              │
│  [████ Label]  [████████████ Value]          │  ← Metadata rows
│  [████ Label]  [████████████ Value]          │
│  [████ Label]  [████████████ Value]          │
├──────────────────────────────────────────────┤
│  [████ Activity/Comments skeleton]           │
└──────────────────────────────────────────────┘
```

### 2D. Budget Page Loading

```
┌──────┬──────┬──────┬──────┐
│[████]│[████]│[████]│[████]│  ← 4 MetricCard skeletons
├──────┴──────┴──────┴──────┤
│  ┌────────────────────────┐│
│  │ [██████ Chart Skel ██] ││  ← Large chart skeleton
│  └────────────────────────┘│
│  [Table skeleton below]    │
└────────────────────────────┘
```

### 2E. Schedule/Gantt Loading

```
┌──────────────────────────────────────────────┐
│  [████ Timeline header skeleton ███████████]  │
├──────────────────────────────────────────────┤
│  [████ ████████████████████]                 │  ← Gantt bar skeleton
│  [████ ████████████]                         │
│  [████ ██████████████████████████]           │
│  [████ ████████████████]                     │
│  [████ ██████████]                           │
└──────────────────────────────────────────────┘
```

---

## Phase 3: Content Transition

### 3A. Skeleton to Content

When data arrives:
1. Skeleton fades out (`opacity: 0`, 150ms)
2. Real content fades in with slide up (`opacity: 0 → 1, y: 6px → 0px`, 200ms)
3. These happen simultaneously (cross-fade)

```typescript
// Hook for skeleton/content transition
function useContentTransition(isLoading: boolean) {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Fade out skeleton
      setShowSkeleton(false);
      // Fade in content after brief overlap
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowSkeleton(true);
      setShowContent(false);
    }
  }, [isLoading]);

  return { showSkeleton, showContent };
}
```

### 3B. Progressive Loading

For pages with multiple data sources (Dashboard):
1. Data sources that resolve first show their real content immediately
2. Others continue showing skeletons
3. Each widget transitions independently

### 3C. Refresh/Refetch

When data is being refreshed (not initial load):
- Do NOT show skeleton again
- Instead: Subtle indicator (thin progress bar at top of container, or faded overlay)
- Content stays visible throughout
- When new data arrives, animate changes (numbers count up/down, rows re-sort)

---

## Phase 4: Empty States

### 4A. Empty State Design

Every entity page needs a unique empty state:

**Common structure:**
```typescript
function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing[16]} ${spacing[8]}`,  // 64px 32px
      textAlign: 'center',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: borderRadius.xl,
        background: colors.surfaceInset,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing[5],
      }}>
        <Icon size={36} strokeWidth={1.5} color={colors.textTertiary} />
      </div>
      <h3 style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing[2],
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: typography.fontSize.sm,
        color: colors.textTertiary,
        maxWidth: '360px',
        lineHeight: typography.lineHeight.normal,
        marginBottom: spacing[6],
      }}>
        {description}
      </p>
      {actionLabel && (
        <Btn variant="primary" onClick={onAction}>
          {actionLabel}
        </Btn>
      )}
    </div>
  );
}
```

### 4B. Page-Specific Empty States

| Page | Icon | Title | Description | Action |
|------|------|-------|-------------|--------|
| RFIs | FileQuestion | No RFIs yet | Create your first Request for Information to get answers from your team | Create RFI |
| Submittals | FileCheck | No submittals | Track material approvals by creating your first submittal | Create Submittal |
| Tasks | CheckSquare | No tasks yet | Break down your project into tasks and assign them to your team | Create Task |
| PunchList | ListChecks | Punch list is clear | No open punch items. Great work on quality control! | Add Punch Item |
| Budget | DollarSign | No budget data | Import your budget or start adding line items to track costs | Import Budget |
| Schedule | Calendar | No schedule yet | Build your project schedule with milestones and dependencies | Create Schedule |
| DailyLog | BookOpen | No daily logs | Start documenting your daily progress with photos, notes, and crew hours | Create Today's Log |
| Safety | Shield | No safety records | Track safety observations, incidents, and toolbox talks | Log Observation |
| Crews | Users | No crews added | Organize your workforce into crews for easier tracking | Add Crew |
| Meetings | Video | No meetings | Schedule and track project meetings with agendas and minutes | Schedule Meeting |
| Files | Folder | No files uploaded | Upload project documents, photos, and drawings | Upload Files |
| Photos (widget) | Camera | No photos today | Capture field photos to document progress | Open Field Capture |
| Directory | Building2 | No companies added | Build your project directory with companies and contacts | Add Company |

### 4C. Filter Empty State

When filters produce no results (different from true empty):
- Icon: Search icon
- Title: "No results found"
- Description: "Try adjusting your filters or search terms"
- Action: "Clear filters" button (secondary variant)
- This should NOT show the "Create" CTA

### 4D. Error State

When data fails to load:
- Icon: AlertTriangle, `colors.statusCritical`
- Title: "Something went wrong"
- Description: "We couldn't load this data. Please try again."
- Action: "Retry" button (primary)
- Optional: Error details in collapsed accordion below

---

## Phase 5: Inline Loading

### 5A. Button Loading

When an action button triggers an async operation:
- Button: Shows spinner icon, text changes to "Saving..." or similar
- Button width: Locked (don't let it shrink/grow)
- Duration: If >2 seconds, show progress (if known) or pulsing state

### 5B. Inline Save Indicators

For auto-saving fields (like inline editing):
- Tiny spinner next to the field while saving (14px)
- On success: Checkmark that fades out after 1 second
- On error: Red X with tooltip explaining the error

### 5C. Page Refresh Indicator

A thin progress bar at the very top of the content area (below TopBar):
- Height: 2px
- Color: `colors.primaryOrange`
- Animation: Indeterminate (moves left to right repeatedly)
- Appears during any background data refresh
- Fades out when complete

---

## Verification Checklist

- [ ] Skeleton component exists with `text`, `circle`, `rect` variants
- [ ] Shimmer animation uses the `shimmer` keyframe at 1.5s
- [ ] Every page has a dedicated loading skeleton matching its layout
- [ ] Dashboard loading: Hero + 5 metrics + widget skeletons
- [ ] Table pages loading: Metrics + header + 5 row skeletons
- [ ] Skeleton-to-content transition: Cross-fade with slide-up
- [ ] Staggered skeleton animations (80ms delay per item)
- [ ] Every entity page has a unique empty state with icon, title, description, and CTA
- [ ] Filter empty state shows "No results" with "Clear filters" button
- [ ] Error state shows retry button
- [ ] Button loading shows spinner with locked width
- [ ] Inline save shows checkmark on success
- [ ] Top progress bar appears during background refreshes
- [ ] No page ever shows a blank white screen during loading
- [ ] No page shows a generic "Loading..." text
- [ ] No page uses a full-screen spinner
