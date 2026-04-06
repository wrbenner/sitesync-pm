# KILLED_FEATURES.md
## Features That Did Not Meet the Bar
<!-- These are not failures. They are the immune system working. -->
<!-- Every killed feature has a reason, an alternative, and a lesson. -->

### KF-001: Gantt Chart (killed 2026-03-15)
**User Need:** Visual schedule display
**Best Candidate Score:** 3.1/10 architecture fit
**Kill Reason:** CPM scheduling requires a separate graph computation layer that would add 45KB to bundle. The superintendent's primary need is "what is late and who is responsible," which is a list view with status, not a Gantt.
**Alternative Shipped:** Critical Path Summary card — delivers 90% of value at 5% of implementation cost.
**Lesson Recorded:** Always validate whether the user need maps to the obvious UI pattern. Supers want answers, not charts.

### KF-002: Custom Form Builder (killed 2026-03-28)
**User Need:** Flexible data collection for inspections and checklists
**Best Candidate Score:** 4.2/10 architecture fit
**Kill Reason:** Form builder adds massive complexity (drag and drop, field types, validation rules, conditional logic). The user need is served by pre built inspection templates that cover 90% of use cases.
**Alternative Shipped:** Inspection template library with 15 standard templates. Custom fields planned for v2 with clear spec.
**Lesson Recorded:** "Flexibility" is often a proxy for "we don't understand the user's actual workflow." Ship the specific solution first.

### KF-003: Custom CSS Animation Library (killed 2026-04-05)
**User Need:** Consistent animations across components
**Kill Reason:** theme.ts + Framer Motion already covers this. Added complexity with no benefit.
**Alternative Shipped:** Framer Motion variants in `src/components/transitions/variants.ts`.
**Lesson Recorded:** Don't build what already exists in the dependency tree.

### KF-004: Custom Charting Library (killed 2026-04-05)
**User Need:** Data visualization for dashboards
**Kill Reason:** @nivo already in dependencies. Replacement would require migrating all existing charts.
**Alternative Shipped:** Continue with @nivo, lazy loaded behind route boundaries.
**Lesson Recorded:** Migration cost of replacing a working library exceeds the benefit of a marginally better one.

### KF-005: React Native Migration (killed 2026-04-05)
**User Need:** Native mobile performance
**Kill Reason:** Capacitor wraps the existing web app. RN migration would require full rewrite. Cost >> benefit. See ADR-005.
**Alternative Shipped:** Capacitor 8 with native plugins for camera, GPS, haptics, push.
**Lesson Recorded:** A working cross-platform app today beats a "better" native app in 6 months.

## Pending Evaluation

*Features under consideration but not yet implemented or killed.*

- [ ] WebRTC peer to peer video for site walkthroughs
- [ ] Blockchain based lien waiver verification
- [ ] Custom form builder for non standard construction workflows (see KF-002 for v1 decision)
