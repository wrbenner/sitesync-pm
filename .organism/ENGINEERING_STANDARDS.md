# SiteSync PM — Engineering Standards

> The organism reads this document to understand what "enterprise-grade" means.
> This is not aspirational — this is the minimum bar. Every cycle should advance
> progress on these fronts.

## Current Stage: Polish & Harden

We have 43 pages, 26 stores, 9 state machines, 130+ tables, and 25 edge functions.
The product EXISTS. Now it needs to be EXTRAORDINARY. Every existing page and
workflow must be enterprise-grade before we build anything new.

---

## What Each Tier Owns

### Design Excellence — Visual & Interaction Quality
- [ ] Every page: Apple-level visual polish (spacing, typography, color, hierarchy)
- [ ] Every page: Loading skeletons (not spinners), error states, empty states
- [ ] Every page: Framer-motion animations (mount/unmount, stagger, spring physics)
- [ ] Every page: Mobile-responsive at 375px, touch targets 48px+
- [ ] Every page: Keyboard navigation with visible focus indicators
- [ ] Every page: Dark mode / theming support via theme.ts tokens
- [ ] Every page: Hover states on interactive elements (lift + shadow)
- [ ] Onboarding flow: first-run experience that guides new users
- [ ] Error state design: friendly, recoverable, never shows raw errors
- [ ] Empty state design: helpful message + clear CTA
- [ ] Notification design: toast notifications for all mutations

### Feature Hardening — Functionality & Robustness
- [ ] Every form: client-side validation (inline errors, not alerts)
- [ ] Every form: prevent double-submit (disable button during submission)
- [ ] Every form: Escape to cancel, Enter to submit
- [ ] Every form: unsaved changes warning on navigate away
- [ ] Every data view: optimistic updates with error rollback
- [ ] Every data view: pull-to-refresh / retry on error
- [ ] Every mutation: try/catch + toast notification (success + error)
- [ ] Every page: graceful degradation when API is slow or offline
- [ ] Every page: proper URL state (deep linking, back button works)
- [ ] Every page: breadcrumb navigation showing context
- [ ] Permissions: role-based UI (hide/disable unauthorized actions)
- [ ] Edge cases: long text truncation, null/zero display, date formatting, currency
- [ ] Search: real-time filtering that works across all list views
- [ ] Pagination: infinite scroll or paginated lists for 100+ items
- [ ] Sorting: column-based sorting on all data tables
- [ ] Export: CSV/PDF export on all data tables

### Quality Swarm — Code Quality
- [ ] ESLint errors: drive to zero
- [ ] TypeScript: strict mode, no `any` types
- [ ] No `eslint-disable` comments
- [ ] No `@ts-ignore` comments
- [ ] Remove unused imports, variables, and dead code
- [ ] Consistent code formatting (Prettier)
- [ ] No hardcoded strings (use theme tokens, constants)
- [ ] React.memo on expensive components
- [ ] Proper dependency arrays on useEffect/useMemo/useCallback

### Strategic Experiments — Architecture & Data Integrity
- [ ] Every entity: kernel-conformant service layer (rfiService.ts pattern)
- [ ] Every service: server-resolved roles (never trust client)
- [ ] Every service: provenance columns (created_by, updated_by)
- [ ] Every service: soft-delete (deleted_at, deleted_by)
- [ ] Every service: lifecycle enforcement via state machines
- [ ] Every store: delegates to service layer (no direct Supabase calls)
- [ ] Every mutation: audit trail
- [ ] RLS policies: enforced on every table
- [ ] Migrations: idempotent (DROP IF EXISTS before CREATE)
- [ ] State machines: validated transitions, role-based permissions
- [ ] API: consistent error format across all endpoints
- [ ] Real-time: Supabase subscriptions for live updates where appropriate

### Testing (ALL tiers contribute)
- [ ] Auth: login, signup, session, protected routes, password reset
- [ ] Service layers: lifecycle transitions, provenance, soft-delete, role enforcement
- [ ] Stores: loading/error states, optimistic updates, error rollback
- [ ] State machines: valid/invalid transitions, role permissions
- [ ] Components: rendering states (loading, error, empty, populated)
- [ ] Forms: validation (accepts good, rejects bad)
- [ ] Edge cases: null values, empty arrays, long strings
- [ ] Target: 200+ test files, 70%+ coverage

### Security (baked into every cycle)
- [ ] No secrets in client-side code
- [ ] Server-resolved roles only (never trust client-side checks)
- [ ] Input validation/sanitization on all user inputs
- [ ] RLS policies on every table
- [ ] CSRF protection (Supabase handles this)
- [ ] Content Security Policy headers
- [ ] Dependency vulnerability scanning (Dependabot)
- [ ] Audit logging on all sensitive operations

### Performance (baked into every cycle)
- [ ] Bundle size: track and reduce (currently ~1.9MB vendor-pdf)
- [ ] Code splitting: lazy load pages (already doing this)
- [ ] Image optimization: WebP, lazy loading
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] No N+1 queries in service layers
- [ ] React.memo to prevent unnecessary re-renders
- [ ] Proper loading skeletons (no layout shift)

### Accessibility
- [ ] Semantic HTML (proper headings, landmarks, roles)
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigable (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader compatible
- [ ] Color contrast WCAG AA minimum
- [ ] Focus management on modals/dialogs
- [ ] Visible focus indicators
- [ ] Skip navigation link

### Documentation (organism generates as it works)
- [ ] README: how to run locally, deploy, configure
- [ ] Architecture: system design, data flow, service patterns
- [ ] API: endpoint documentation for all edge functions
- [ ] Components: Storybook or similar for the design system
- [ ] Runbooks: how to debug common issues
- [ ] Onboarding: guide for new developers

---

## Priority Order (what to work on first)

1. **Auth & Login** — users can't use the platform if they can't log in
2. **Core pages to enterprise quality** — Dashboard, RFIs, Budget, DailyLog, Submittals
3. **Service layer coverage** — every entity through the kernel pattern
4. **Test coverage** — 200+ tests, every critical path covered
5. **Secondary pages** — Schedule, Safety, Reports, Settings, Teams
6. **Performance** — bundle size, Core Web Vitals
7. **Accessibility** — WCAG AA compliance
8. **Documentation** — README, architecture, API docs

The organism should work through this list top to bottom. Every cycle
should make measurable progress. If a higher-priority item regresses,
fix it before working on lower-priority items.
