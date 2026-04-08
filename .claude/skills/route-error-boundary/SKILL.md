---
name: route-error-boundary
description: Wrap route-level components in ErrorBoundary for graceful error handling
version: "1.0.0"
when_to_use: When adding new pages/routes, when finding unhandled render errors in the console, or when a component crash white-screens the entire app
allowed-tools: read_file, write_file, bash
---

## Overview

React 19 still requires class-based ErrorBoundary components (or a library wrapper) to catch render-time errors in component subtrees. In SiteSync, every route-level component must be wrapped so that a single bad data response or null reference doesn't white-screen the entire app — especially critical on job sites with spotty connectivity that can produce unexpected null payloads.

The boundary lives in `App.tsx` around each `<Route>` element, and uses a shared `<SiteSyncErrorFallback>` component that shows a construction-themed recovery UI.

## Detection

Look for these signs that an error boundary is missing:

- White screen on the job site (user reports "app went blank")
- Console shows `Uncaught Error` without a React error boundary stack frame
- A route component renders directly as `<Route element={<ComponentName />}>` without any wrapping
- New pages added to `App.tsx` without `<ErrorBoundary>` wrapper

## The ErrorBoundary Component

Location: `src/components/ErrorBoundary.tsx`

```tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string; // For error reporting context
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to your error tracking service here
    console.error(`[ErrorBoundary:${this.props.routeName ?? 'unknown'}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <SiteSyncErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}
```

## The Fallback Component

Location: `src/components/SiteSyncErrorFallback.tsx`

```tsx
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  error: Error | null;
  onReset: () => void;
}

export function SiteSyncErrorFallback({ error, onReset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
      {/* Icon — large for industrial display readability */}
      <AlertTriangle
        className="text-amber-500"
        style={{ width: 64, height: 64 }}
        aria-hidden
      />

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="text-gray-500 max-w-sm">
          This section hit an unexpected error. Your other data is safe.
        </p>
        {/* Show error detail in development only */}
        {import.meta.env.DEV && error && (
          <pre className="mt-2 text-xs text-left bg-gray-100 p-3 rounded overflow-auto max-w-lg">
            {error.message}
          </pre>
        )}
      </div>

      {/* 56px touch target for gloved use */}
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        style={{ minHeight: 56 }}
      >
        <RefreshCw size={18} />
        Try again
      </button>
    </div>
  );
}
```

## Where to Place It in App.tsx

Wrap each `<Route>` element at the route level — not around the entire router, so other routes remain accessible when one fails:

```tsx
// src/App.tsx — CORRECT pattern
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      {/* Each route gets its own boundary */}
      <Route
        path="/projects"
        element={
          <ErrorBoundary routeName="projects">
            <ProjectsPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/projects/:id/daily-log"
        element={
          <ErrorBoundary routeName="daily-log">
            <DailyLogPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/punch-list"
        element={
          <ErrorBoundary routeName="punch-list">
            <PunchListPage />
          </ErrorBoundary>
        }
      />
      {/* ... other routes */}
    </Routes>
  );
}
```

**Do NOT** wrap with a single boundary around `<Routes>` — this would take down all navigation when any page errors.

## Resolution Steps

### Step 1 — Check if ErrorBoundary component exists

```bash
ls src/components/ErrorBoundary.tsx
```

If missing, create it from the pattern above.

### Step 2 — Check if SiteSyncErrorFallback exists

```bash
ls src/components/SiteSyncErrorFallback.tsx
```

If missing, create it from the pattern above.

### Step 3 — Audit App.tsx for unwrapped routes

```bash
grep -n "<Route" src/App.tsx
```

Any `<Route element={<SomePage />}>` without an `<ErrorBoundary>` wrapper is a gap.

### Step 4 — Wrap new route

Add the `<ErrorBoundary routeName="your-page">` wrapper around the page component. Pass `routeName` to help with debugging — it appears in the console error log.

### Step 5 — Test the error state

Temporarily throw in the target component to verify the boundary catches it:

```tsx
// Add temporarily to the component being tested
throw new Error('Test error boundary');
```

Verify: the rest of the app (nav, other routes) remains functional. The fallback UI appears with "Try again". Remove the test throw after verification.

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Single boundary around `<Routes>` | Entire app white-screens | Move boundary inside each `<Route>` |
| Boundary catches async errors | Async errors (in useEffect, event handlers) are NOT caught | Use try/catch + error state in those hooks |
| Missing `handleReset` | User clicks "Try again" but error persists | Ensure `setState({ hasError: false })` is called |
| Fallback has tiny touch targets | Hard to tap "Try again" in field | Enforce 56px min-height on all fallback buttons |

## Notes on Async Errors

ErrorBoundary does **not** catch errors thrown in:
- `useEffect` callbacks
- Event handlers
- Async functions (including `async/await` in component body)

For those, use local error state:

```tsx
const [error, setError] = useState<Error | null>(null);

useEffect(() => {
  fetchData().catch(err => setError(err));
}, []);

if (error) return <SiteSyncErrorFallback error={error} onReset={() => setError(null)} />;
```

## Usage Tracking

usage_count: 0
last_used: null
