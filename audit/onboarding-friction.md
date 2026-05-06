# Onboarding Friction — IT admin

This file lists steps in the IT-admin onboarding persona that exceeded
the 90-second-per-step target, plus the dominant blocker for each.

| Step | Elapsed (ms) | Blocker | Proposed fix |
| --- | --- | --- | --- |

<!-- Rows appended by it-admin-onboarding.spec.ts during runs. -->

## Top 5 friction points (static, derived from the wiring backlog)

These are the worst offenders even before timing data is captured —
because each is a missing route, the IT admin cannot complete the step at
all today:

1. **Bulk invite of 12 users** — `/admin/bulk-invite` not registered in
   `src/App.tsx`. Implementation lives at `src/pages/admin/bulk-invite/`.
   Fix: add the route registration.
2. **Cost code library import** — `/admin/cost-code-library` not
   registered. Importers exist at `src/lib/integrations/costCodeImporters/`.
   Fix: add the route registration.
3. **Project setup from template** — `/admin/project-templates` not
   registered. Templates exist at `src/lib/projectTemplates/`. Fix: add
   the route registration.
4. **Procore one-shot import** — `/admin/procore-import` not registered.
   Mappers exist at `src/lib/integrations/procore/`. Fix: route + finish
   vendoring `supabase/functions/shared/` per docs/ENTERPRISE_ADOPTION_PACK.md.
5. **SSO smoke test** — admin SSO page exists at `/admin/sso` but the
   "Test connection" button does not surface a verification result UI;
   the IT admin cannot tell whether SSO works without seeing the user
   land back in the app. Fix: render a confirmation panel after the
   sso-saml-handler / sso-oidc-handler edge fn returns.
