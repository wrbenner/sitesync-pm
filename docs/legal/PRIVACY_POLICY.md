# SiteSync Privacy Policy

**Last updated:** April 27, 2026

This Privacy Policy describes how SiteSync ("we," "us") collects, uses, and
shares information about you when you use the SiteSync web application,
the SiteSync mobile application, and related services (collectively, the
"Service"). It is written to satisfy our obligations under the EU General
Data Protection Regulation (GDPR), the California Consumer Privacy Act
(CCPA/CPRA), and Apple App Store Guideline 5.1.1.

> **Reviewer note (Apple):** Account deletion is available in-app under
> *Profile → Danger Zone → Delete Account*. It is irreversible, processes
> server-side via the `delete-account` Supabase Edge Function, and cascades
> to all personally-identifying data we hold via FK constraints.

---

## 1. Who we are

SiteSync is operated by **SiteSync, Inc.** (the "Company"). For privacy
inquiries, contact `privacy@sitesync.com`.

Where this Policy refers to a "data controller" or "business" under
applicable law, that role is held by the Company.

## 2. Information we collect

### 2.1 Information you provide

| Category | Examples | Purpose |
|---|---|---|
| **Account** | Email address, password (hashed) | Sign in, transactional email |
| **Profile** | First/last name, phone, job title, company, trade, avatar | Show your identity inside projects |
| **Project content** | Daily logs, RFIs, punch list items, drawings, photos, voice memos, comments, signatures | Core product functionality |
| **Communications** | Support tickets, feedback you submit | Respond to and improve the Service |

### 2.2 Information collected automatically

| Category | Source | Purpose |
|---|---|---|
| **Diagnostics** | Sentry (error stack traces, breadcrumbs, session replay at 1% of sessions / 100% on error) | Triage crashes and bugs |
| **Product analytics** | PostHog (page views, feature usage, performance metrics — Web Vitals) | Understand usage patterns, improve UX |
| **Device/network** | User-agent, IP address (stripped before forwarding to Sentry), language, timezone | Localization, security |

### 2.3 Information collected only with your permission

| Category | Source | Purpose |
|---|---|---|
| **Camera/photos** | iOS / Android system permission | Capture jobsite photos you choose to attach |
| **Photo library** | iOS / Android system permission | Attach existing photos to project records |
| **Microphone** | iOS / Android system permission | Record voice memos you attach to logs |
| **Location** | iOS / Android system permission | Tag the captures you choose to take |

You can revoke any of these permissions at any time through your device
settings. The Service will continue to function with reduced capability.

### 2.4 What we do **not** collect

- We do **not** collect your contacts, browsing history outside the app,
  health data, financial-account information, or precise background
  location.
- We do **not** track you across other companies' apps or websites.
- We do **not** sell your personal information.

## 3. How we use information

We use information to:

1. Operate, maintain, and provide features of the Service.
2. Authenticate you and protect your account.
3. Send transactional notifications you have opted into (assignment
   alerts, overdue items, daily summaries).
4. Diagnose and fix bugs.
5. Improve the Service through aggregated, de-identified analytics.
6. Comply with legal obligations and enforce our Terms.

We rely on the following lawful bases under GDPR Art. 6: performance of
contract (operating the Service), legitimate interests (analytics,
fraud prevention), consent (camera/location/microphone access), and
legal obligation.

## 4. How we share information

| Recipient | Why | Location |
|---|---|---|
| **Supabase** (database, auth, storage) | Primary data store | US |
| **Sentry** | Error monitoring | US |
| **PostHog** | Product analytics | US (cloud region) |
| **Liveblocks** | Real-time collaboration | US |
| **Anthropic** | AI features (when you invoke them) | US |
| **OpenWeather** | Weather data on daily logs | US |

Each is bound by a Data Processing Agreement requiring confidentiality,
deletion on request, and security controls equivalent to those described
in our Trust Center at `https://sitesync.com/security`.

We share your project content **only with other authenticated members
of the same project**. We do not publish your data publicly.

We may disclose information in response to a valid legal process (e.g.,
subpoena), to protect the rights and safety of users, or in connection
with a corporate transaction (merger, acquisition), in which case the
acquirer will be bound by this Policy.

## 5. International transfers

Your information is processed in the United States. Where you are in
the EEA, UK, or Switzerland, we rely on Standard Contractual Clauses
(2021/914/EU) for cross-border transfers.

## 6. Retention

| Data | Retention |
|---|---|
| Account & profile | Until you delete your account |
| Project content (logs, RFIs, photos) | Retained by the project owner organization until they delete the project |
| Sentry events | 90 days |
| PostHog events | 12 months |
| Audit logs | 7 years (regulatory) |
| Account deletion records (hashed user id only) | 7 years |

Backups are retained for up to 35 days and then expire automatically.

## 7. Your rights

Depending on your jurisdiction, you have the right to:

- **Access** the personal data we hold about you.
- **Correct** inaccurate data (most fields are editable in
  *Profile* directly).
- **Delete** your account and personal data (*Profile → Danger Zone →
  Delete Account*).
- **Port** your data (export available on request).
- **Object** to or **restrict** processing.
- **Withdraw consent** for camera, location, microphone, and analytics
  at any time via your device settings.
- **Lodge a complaint** with your local data-protection authority.

Email `privacy@sitesync.com` to exercise any right we cannot fulfill
in-app. We respond within 30 days (45 for CCPA requests).

## 8. Security

We use industry-standard controls including TLS 1.2+ in transit,
AES-256 at rest, row-level security (RLS) for tenant isolation,
multi-factor authentication for staff access, and continuous
vulnerability scanning. See our Trust Center at
`https://sitesync.com/security` for details.

No system is perfectly secure. If you believe your account has been
compromised, contact `security@sitesync.com` immediately.

## 9. Children

The Service is not directed to anyone under 16. We do not knowingly
collect data from children. If you believe we have, email
`privacy@sitesync.com` and we will delete it.

## 10. California privacy rights (CCPA/CPRA)

In the past 12 months we have collected the categories of personal
information described in Section 2 for the business purposes described
in Section 3. We do not sell or share personal information for
cross-context behavioral advertising. California residents have the
right to know, delete, correct, and limit use of sensitive information.

## 11. Changes

We will post any changes to this Policy on this page and notify you
via email for material changes at least 30 days before they take effect.

## 12. Contact

**SiteSync, Inc.**
`privacy@sitesync.com`
