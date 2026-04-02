# SiteSync AI Backend Architecture

**Version**: 1.0
**Last Updated**: 2026-04-01
**Target**: Autonomous code evolution engine — read before every audit cycle

---

## 1. Technology Stack

### Core Infrastructure
- **Database**: Supabase (PostgreSQL 15+)
  - Built on managed PostgreSQL with automatic backups, failover, and replication
  - Logical replication for read replicas in production
  - Connection pooling via pgBouncer (25 connections per project)

- **Authentication**: Supabase Auth
  - Built-in JWT token generation with 3600s expiry (1 hour)
  - Refresh tokens valid for 7 days
  - Providers: Email/password, Magic Link, Google OAuth 2.0
  - Multi-factor authentication via TOTP (stored in auth.users user_metadata)

- **Storage**: Supabase Storage (S3-compatible)
  - Bucket-based isolation with RLS policies
  - Signed URLs with custom expiry (default 1 hour for sensitive files)
  - CDN acceleration via Supabase CDN

- **Realtime**: Supabase Realtime (PostgreSQL NOTIFY/LISTEN)
  - Broadcast channels for presence (who's viewing a drawing)
  - Postgres channels for table subscriptions
  - 5000 concurrent connections per region

- **Edge Functions**: Deno-based serverless (Supabase Edge Functions)
  - Auto-scaled, cold start under 100ms
  - Environment variables for API keys, secrets
  - Scheduled functions via cron

- **Client Library**: @supabase/supabase-js v2
  - Compiled for modern browsers + Node.js
  - Built-in retry logic (exponential backoff)
  - Type-safe query generation with TypeScript

### API Patterns
- **No custom REST API**: All data flows through Supabase client SDK
- **Optimistic Updates**: Frontend assumes success, reverts on error
- **Cursor-Based Pagination**: Efficient for large datasets
- **Full-Text Search**: PostgreSQL tsvector columns for RFIs, submittals, files

---

## 2. Database Architecture

### Core Principles
- **Multi-Tenancy**: Every table has `project_id` (UUID) foreign key to `projects`
- **Soft Deletes**: All tables have `deleted_at` (timestamptz, nullable)
- **Audit Trail**: All tables have `created_by`, `updated_by`, `created_at`, `updated_at`
- **UUID PKs**: All primary keys are UUID v4, generated server-side
- **Immutable Created Fields**: `created_at` and `created_by` never change after insert

### Organizations & Users

#### organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- for URL: app.sitesync.io/org/{slug}
  logo_url TEXT, -- signed URL to logo in storage.avatars
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free', -- free, starter, pro, enterprise
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, past_due, canceled
  subscription_end_date TIMESTAMPTZ,
  max_users INT NOT NULL DEFAULT 5,
  max_projects INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);
```

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, -- from auth.users
  phone TEXT,
  avatar_url TEXT, -- signed URL to storage.avatars
  job_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_users_organization ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
```

#### user_roles
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id),
  role VARCHAR(50) NOT NULL,
  -- roles: owner, admin, project_manager, superintendent, foreman, subcontractor, read_only
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ, -- optional: temp access
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, project_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_project ON user_roles(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_role ON user_roles(role) WHERE deleted_at IS NULL;
```

### Projects

#### projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, on_hold, completed, archived
  project_number TEXT, -- client's internal project code
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  general_contractor TEXT,
  owner TEXT,
  architect TEXT,
  start_date DATE,
  scheduled_completion DATE,
  actual_completion DATE,
  budget_total DECIMAL(15, 2), -- in USD cents * 100 for precision
  contract_amount DECIMAL(15, 2),
  estimated_labor_hours INT,
  project_type VARCHAR(50), -- commercial, residential, industrial, infrastructure
  primary_contact_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_projects_organization ON projects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_slug ON projects(organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_start_date ON projects(start_date) WHERE deleted_at IS NULL;
```

#### project_members
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_members_user ON project_members(user_id) WHERE deleted_at IS NULL;
```

### RFIs (Request for Information)

#### rfis
```sql
CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL, -- auto-increment: RFI-001, RFI-002, etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, in_review, answered, closed, on_hold
  category TEXT, -- design, specification, coordination, constructability, other
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  assigned_to UUID REFERENCES users(id), -- architect or engineer
  date_submitted TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_due TIMESTAMPTZ,
  date_answered TIMESTAMPTZ,
  submitted_by UUID NOT NULL REFERENCES users(id),
  search_text TSVECTOR, -- for full-text search
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_rfis_project ON rfis(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfis_number ON rfis(project_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfis_status ON rfis(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfis_assigned_to ON rfis(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfis_date_submitted ON rfis(date_submitted DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfis_search ON rfis USING GIN(search_text);
```

#### rfi_responses
```sql
CREATE TABLE rfi_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  responded_by UUID NOT NULL REFERENCES users(id),
  response_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_rfi_responses_rfi ON rfi_responses(rfi_id) WHERE deleted_at IS NULL;
```

#### rfi_attachments
```sql
CREATE TABLE rfi_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id),
  attachment_type VARCHAR(20) NOT NULL DEFAULT 'reference', -- reference, response, photo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_rfi_attachments_rfi ON rfi_attachments(rfi_id);
```

### Submittals

#### submittals
```sql
CREATE TABLE submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  submittal_type VARCHAR(50) NOT NULL, -- equipment, material, system, drawing, procedure
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, approved_as_noted, rejected, resubmit
  assigned_to UUID REFERENCES users(id), -- reviewer
  date_submitted TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_due TIMESTAMPTZ,
  date_approved TIMESTAMPTZ,
  contractor_id UUID REFERENCES users(id),
  search_text TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_submittals_project ON submittals(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_submittals_number ON submittals(project_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_submittals_status ON submittals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_submittals_assigned_to ON submittals(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_submittals_search ON submittals USING GIN(search_text);
```

#### submittal_revisions
```sql
CREATE TABLE submittal_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES submittals(id) ON DELETE CASCADE,
  revision_number INT NOT NULL DEFAULT 0,
  revision_notes TEXT,
  submitted_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_submittal_revisions_submittal ON submittal_revisions(submittal_id);
```

#### submittal_reviewers
```sql
CREATE TABLE submittal_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES submittals(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, approved_as_noted
  comments TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submittal_id, reviewer_id)
);

CREATE INDEX idx_submittal_reviewers_submittal ON submittal_reviewers(submittal_id);
```

### Change Orders (3-Tier PCO/COR/CO)

#### change_orders
```sql
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL, -- PCO-001, COR-001, CO-001
  co_type VARCHAR(20) NOT NULL, -- pco (preliminary), cor (construction order request), co (approved)
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, implemented
  reason TEXT, -- design change, unforeseen condition, owner request, schedule impact
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approval_date TIMESTAMPTZ,
  implementation_date TIMESTAMPTZ,
  total_cost DECIMAL(15, 2), -- sum of line items
  total_time_impact INT, -- hours
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_change_orders_project ON change_orders(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_change_orders_number ON change_orders(project_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_change_orders_type ON change_orders(co_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_change_orders_status ON change_orders(status) WHERE deleted_at IS NULL;
```

#### change_order_line_items
```sql
CREATE TABLE change_order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 4) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  unit TEXT, -- LF, SF, HR, EA, CY
  total_price DECIMAL(15, 2) NOT NULL, -- quantity * unit_price
  labor_hours DECIMAL(10, 2),
  material_cost DECIMAL(12, 2),
  equipment_cost DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_change_order_line_items_co ON change_order_line_items(change_order_id);
```

### Daily Logs

#### daily_logs
```sql
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  log_date DATE NOT NULL,
  weather_description TEXT, -- sunny, cloudy, rainy, snowy
  temperature_high INT, -- fahrenheit
  temperature_low INT,
  weather_notes TEXT,
  site_visit_notes TEXT,
  safety_incidents INT NOT NULL DEFAULT 0,
  safety_notes TEXT,
  visitor_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, log_date)
);

CREATE INDEX idx_daily_logs_project ON daily_logs(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date DESC) WHERE deleted_at IS NULL;
```

#### daily_log_entries
```sql
CREATE TABLE daily_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  entry_type VARCHAR(20) NOT NULL, -- labor, equipment, notes, visitor, safety
  crew_id UUID REFERENCES crews(id),
  crew_size INT, -- number of workers
  hours_worked DECIMAL(5, 2),
  task_description TEXT NOT NULL,
  equipment_name TEXT,
  equipment_hours DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_daily_log_entries_log ON daily_log_entries(daily_log_id);
CREATE INDEX idx_daily_log_entries_crew ON daily_log_entries(crew_id) WHERE crew_id IS NOT NULL;
```

### Punch List

#### punch_list_items
```sql
CREATE TABLE punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, in_progress, completed, deferred
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id),
  assigned_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  trade TEXT, -- drywall, electrical, plumbing, HVAC, painting, carpentry
  location TEXT,
  estimated_hours DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_punch_list_items_project ON punch_list_items(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_punch_list_items_status ON punch_list_items(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_punch_list_items_assigned_to ON punch_list_items(assigned_to) WHERE deleted_at IS NULL;
```

#### punch_list_photos
```sql
CREATE TABLE punch_list_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_item_id UUID NOT NULL REFERENCES punch_list_items(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id),
  photo_type VARCHAR(20) NOT NULL DEFAULT 'before', -- before, during, after, reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_punch_list_photos_item ON punch_list_photos(punch_list_item_id);
```

### Drawings

#### drawings
```sql
CREATE TABLE drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL, -- A1.0, A2.1, etc.
  title TEXT NOT NULL,
  description TEXT,
  discipline VARCHAR(20) NOT NULL, -- architectural, structural, mechanical, electrical, plumbing
  revision INT NOT NULL DEFAULT 0,
  date_issued DATE,
  issued_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, superseded, archived
  file_id UUID NOT NULL REFERENCES files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_drawings_project ON drawings(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_drawings_number ON drawings(project_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_drawings_discipline ON drawings(discipline) WHERE deleted_at IS NULL;
```

#### drawing_sets
```sql
CREATE TABLE drawing_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, -- "100% Construction Docs", "Bid Docs", "As-Built"
  date_created DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_drawing_sets_project ON drawing_sets(project_id) WHERE deleted_at IS NULL;
```

#### drawing_markups
```sql
CREATE TABLE drawing_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  markup_data JSONB NOT NULL, -- { type: "circle", x, y, radius, color, label, timestamp }
  markup_type VARCHAR(20) NOT NULL, -- circle, rectangle, line, freehand, text, callout
  color VARCHAR(20) NOT NULL DEFAULT 'red',
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_drawing_markups_drawing ON drawing_markups(drawing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_drawing_markups_user ON drawing_markups(user_id);
```

### Schedule (CPM Activities & Links)

#### schedule_activities
```sql
CREATE TABLE schedule_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  activity_code TEXT NOT NULL, -- unique within project: 1001, 1002, etc.
  description TEXT NOT NULL,
  activity_type VARCHAR(20) NOT NULL DEFAULT 'work', -- work, milestone, summary
  status VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, on_hold
  original_duration INT NOT NULL, -- days
  remaining_duration INT,
  planned_start DATE NOT NULL,
  planned_finish DATE NOT NULL,
  early_start DATE,
  early_finish DATE,
  late_start DATE,
  late_finish DATE,
  actual_start DATE,
  actual_finish DATE,
  percent_complete INT NOT NULL DEFAULT 0,
  responsible_party UUID REFERENCES users(id),
  crew_id UUID REFERENCES crews(id),
  resource_group TEXT, -- "Equipment", "Labor", "Materials"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_schedule_activities_project ON schedule_activities(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_activities_code ON schedule_activities(project_id, activity_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_activities_status ON schedule_activities(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_activities_planned_start ON schedule_activities(planned_start) WHERE deleted_at IS NULL;
```

#### schedule_links
```sql
CREATE TABLE schedule_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  predecessor_id UUID NOT NULL REFERENCES schedule_activities(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES schedule_activities(id) ON DELETE CASCADE,
  link_type VARCHAR(2) NOT NULL, -- FS (finish-to-start), FF, SS, SF
  lag_days INT NOT NULL DEFAULT 0, -- positive or negative
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(predecessor_id, successor_id)
);

CREATE INDEX idx_schedule_links_project ON schedule_links(project_id);
CREATE INDEX idx_schedule_links_predecessor ON schedule_links(predecessor_id);
CREATE INDEX idx_schedule_links_successor ON schedule_links(successor_id);
```

### Budget

#### budget_line_items
```sql
CREATE TABLE budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  line_number TEXT NOT NULL, -- CSI division: 02100, 02200, 03000, 05000, etc.
  csi_division VARCHAR(50) NOT NULL, -- "Site Excavation", "Concrete", "Steel", "Framing"
  description TEXT NOT NULL,
  original_budget DECIMAL(15, 2) NOT NULL, -- initial estimate
  current_budget DECIMAL(15, 2) NOT NULL, -- after change orders
  spent_to_date DECIMAL(15, 2) NOT NULL DEFAULT 0,
  committed DECIMAL(15, 2) NOT NULL DEFAULT 0, -- purchase orders, pending invoices
  remaining_budget DECIMAL(15, 2) GENERATED ALWAYS AS (current_budget - spent_to_date - committed) STORED,
  percent_complete INT,
  responsible_party UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_budget_line_items_project ON budget_line_items(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budget_line_items_csi ON budget_line_items(csi_division) WHERE deleted_at IS NULL;
```

#### budget_transactions
```sql
CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_item_id UUID NOT NULL REFERENCES budget_line_items(id),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- invoice, purchase_order, credit, commitment
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  reference_number TEXT, -- invoice number, PO number
  vendor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_budget_transactions_line_item ON budget_transactions(budget_line_item_id);
CREATE INDEX idx_budget_transactions_date ON budget_transactions(transaction_date DESC);
```

### Pay Applications & Lien Waivers

#### pay_applications
```sql
CREATE TABLE pay_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  application_number INT NOT NULL, -- 1, 2, 3, etc.
  application_date DATE NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  submitted_by UUID NOT NULL REFERENCES users(id),
  submitted_to UUID REFERENCES users(id), -- project manager or GC
  submission_date TIMESTAMPTZ,
  approval_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, paid
  total_payment_requested DECIMAL(15, 2),
  total_previous_payments DECIMAL(15, 2),
  payment_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_pay_applications_project ON pay_applications(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pay_applications_status ON pay_applications(status) WHERE deleted_at IS NULL;
```

#### pay_app_line_items
```sql
CREATE TABLE pay_app_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_application_id UUID NOT NULL REFERENCES pay_applications(id) ON DELETE CASCADE,
  budget_line_item_id UUID REFERENCES budget_line_items(id),
  description TEXT NOT NULL,
  original_contract_amount DECIMAL(15, 2),
  change_orders DECIMAL(15, 2),
  contract_sum_to_date DECIMAL(15, 2),
  previous_payment DECIMAL(15, 2),
  current_payment DECIMAL(15, 2),
  percent_complete INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_app_line_items_pay_app ON pay_app_line_items(pay_application_id);
```

#### lien_waivers
```sql
CREATE TABLE lien_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  pay_application_id UUID REFERENCES pay_applications(id),
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  lien_waiver_type VARCHAR(20) NOT NULL, -- conditional, unconditional, partial, final
  amount_waived DECIMAL(15, 2) NOT NULL,
  period_covered_through DATE NOT NULL,
  waiver_date DATE NOT NULL,
  signed_date DATE,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_lien_waivers_project ON lien_waivers(project_id) WHERE deleted_at IS NULL;
```

### Crews & Assignments

#### crews
```sql
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, -- "Concrete Crew", "Framing Crew"
  description TEXT,
  trade TEXT NOT NULL, -- carpentry, electrical, plumbing, HVAC, etc.
  foreman_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crews_project ON crews(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crews_trade ON crews(trade) WHERE deleted_at IS NULL;
```

#### crew_members
```sql
CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(50) NOT NULL, -- worker, lead, foreman, safety_officer
  hours_per_week DECIMAL(5, 2),
  joined_date DATE NOT NULL,
  left_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(crew_id, user_id)
);

CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX idx_crew_members_user ON crew_members(user_id);
```

#### crew_assignments
```sql
CREATE TABLE crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id),
  activity_id UUID NOT NULL REFERENCES schedule_activities(id),
  assigned_date DATE NOT NULL,
  duration_days INT,
  percent_allocation INT NOT NULL DEFAULT 100, -- 0-100%
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(crew_id, activity_id)
);

CREATE INDEX idx_crew_assignments_crew ON crew_assignments(crew_id);
CREATE INDEX idx_crew_assignments_activity ON crew_assignments(activity_id);
```

### Meetings

#### meetings
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type VARCHAR(50) NOT NULL, -- standup, progress, safety, coordination, owner, pre_construction
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  location TEXT,
  meeting_url TEXT, -- for virtual meetings
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, canceled
  organizer_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_meetings_project ON meetings(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_meetings_scheduled_start ON meetings(scheduled_start) WHERE deleted_at IS NULL;
```

#### meeting_attendees
```sql
CREATE TABLE meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'invited', -- invited, attending, absent, no_response
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);
```

#### meeting_action_items
```sql
CREATE TABLE meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to UUID NOT NULL REFERENCES users(id),
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, completed, canceled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_meeting_action_items_meeting ON meeting_action_items(meeting_id);
```

### Files & Versioning

#### files
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  file_name TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- pdf, dwg, docx, xlsx, jpg, png, etc.
  file_size INT NOT NULL, -- bytes
  storage_path TEXT NOT NULL UNIQUE, -- s3://bucket/project-id/file-id/filename
  bucket VARCHAR(50) NOT NULL, -- project-files, field-photos, exports
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, archived, deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_files_project ON files(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_upload_date ON files(upload_date DESC) WHERE deleted_at IS NULL;
```

#### file_versions
```sql
CREATE TABLE file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(file_id, version_number)
);

CREATE INDEX idx_file_versions_file ON file_versions(file_id);
```

### Notifications & Activity Feed

#### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  notification_type VARCHAR(50) NOT NULL, -- rfi_assigned, submittal_approved, punch_list_due, meeting_scheduled
  title TEXT NOT NULL,
  message TEXT,
  related_entity_type VARCHAR(50), -- rfi, submittal, punch_list_item, meeting, activity
  related_entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

#### activity_feed
```sql
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  action_type VARCHAR(50) NOT NULL, -- created, updated, commented, status_changed, deleted
  entity_type VARCHAR(50) NOT NULL, -- rfi, submittal, punch_list_item, drawing, meeting, activity
  entity_id UUID NOT NULL,
  entity_name TEXT,
  actor_id UUID NOT NULL REFERENCES users(id),
  changes JSONB, -- { field: old_value, new_value }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_project ON activity_feed(project_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_entity ON activity_feed(entity_type, entity_id);
```

### AI Features

#### ai_conversations
```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_id UUID NOT NULL REFERENCES users(id),
  conversation_topic VARCHAR(50) NOT NULL, -- general, schedule, budget, safety, coordination
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT, -- auto-generated after conversation ends
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ai_conversations_project ON ai_conversations(project_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
```

#### ai_messages
```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  metadata JSONB, -- { tokens_used, model, latency_ms }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);
```

---

## 3. Row Level Security Policies

### Principles
- Every query is filtered by `project_id` or `organization_id`
- Users only see projects they're members of
- Admins see all projects in their organization
- Roles determine what actions are allowed

### Role Hierarchy & Permissions

| Role | Org Level | Create | Update | Delete | Notes |
|------|-----------|--------|--------|--------|-------|
| `owner` | Org | ✓ | ✓ | ✓ | Can create projects, manage users, billing |
| `admin` | Org | ✓ | ✓ | ✓ | Can manage all projects in org |
| `project_manager` | Project | ✓ | ✓ | Limited | Full project control, can't delete |
| `superintendent` | Project | ✓ | ✓ | Limited | Field operations, daily logs, punch list |
| `foreman` | Project | ✓ | ✓ | Own | Can create/update own crew assignments |
| `subcontractor` | Project | ✓ | Limited | Own | Can submit, view relevant docs only |
| `read_only` | Project | ✗ | ✗ | ✗ | Stakeholders, inspectors, consultants |

### RLS Policy Templates

#### Project Access (Base Policy)
```sql
-- All tables with project_id must enforce this
CREATE POLICY "users_can_view_own_projects"
ON <table> FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
  OR
  project_id IN (
    SELECT projects.id
    FROM projects
    JOIN organizations ON projects.organization_id = organizations.id
    JOIN users ON users.organization_id = organizations.id
    WHERE users.id = auth.uid() AND (
      SELECT role FROM user_roles
      WHERE user_id = auth.uid() AND project_id = projects.id
      LIMIT 1
    ) IN ('owner', 'admin')
  )
);

CREATE POLICY "project_members_can_insert"
ON <table> FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "project_members_can_update"
ON <table> FOR UPDATE
USING (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
);
```

#### RFI-Specific Policies
```sql
-- Only assigned user or PM can update RFI status
CREATE POLICY "rfi_status_update_restricted"
ON rfis FOR UPDATE
USING (
  assigned_to = auth.uid() OR
  (SELECT role FROM user_roles WHERE user_id = auth.uid() AND project_id = project_id LIMIT 1) IN ('project_manager', 'admin')
)
WITH CHECK (
  assigned_to = auth.uid() OR
  (SELECT role FROM user_roles WHERE user_id = auth.uid() AND project_id = project_id LIMIT 1) IN ('project_manager', 'admin')
);
```

#### Submittal Review Policies
```sql
-- Reviewers can only update their own review
CREATE POLICY "submittal_reviewer_can_update_own"
ON submittal_reviewers FOR UPDATE
USING (
  reviewer_id = auth.uid()
)
WITH CHECK (
  reviewer_id = auth.uid()
);
```

#### Budget Visibility
```sql
-- Subcontractors can only see their own line items
CREATE POLICY "subcontractor_budget_visibility"
ON budget_line_items FOR SELECT
USING (
  (SELECT role FROM user_roles WHERE user_id = auth.uid() AND project_id = budget_line_items.project_id LIMIT 1) != 'subcontractor'
  OR
  responsible_party = auth.uid()
);
```

#### Crew Assignment Rules
```sql
-- Foreman can only manage own crew's assignments
CREATE POLICY "foreman_crew_assignments"
ON crew_assignments FOR UPDATE
USING (
  crew_id IN (
    SELECT id FROM crews WHERE foreman_id = auth.uid()
  )
)
WITH CHECK (
  crew_id IN (
    SELECT id FROM crews WHERE foreman_id = auth.uid()
  )
);
```

---

## 4. Authentication & RBAC

### Supabase Auth Configuration

#### Email/Password + Magic Link
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Sign up with email and password
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });
  return { data, error };
}

// Sign in with email link
export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });
  return { data, error };
}

// Google OAuth
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  return { data, error };
}
```

#### JWT Claims & Metadata
```typescript
// Custom claims in auth.users.raw_user_meta_data
{
  "org_id": "uuid-of-org",
  "role": "project_manager", // fallback to user_roles table
  "mfa_enabled": true,
  "profile_complete": true
}

// Decoded JWT token
{
  "sub": "user-uuid",
  "aud": "authenticated",
  "iss": "https://project-id.supabase.co/auth/v1",
  "iat": 1234567890,
  "exp": 1234571490,
  "user_metadata": {
    "org_id": "org-uuid",
    "role": "project_manager"
  }
}
```

#### Session Management
```typescript
// Session stored in localStorage
// Auto-refresh: token refreshed 30 seconds before expiry
// Sign out: DELETE from auth.sessions, clear localStorage
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  // Frontend clears local auth state
  return { error };
}

// Check session
const {
  data: { session }
} = await supabase.auth.getSession();
```

#### MFA Setup (TOTP)
```typescript
// Enable TOTP for user
export async function enableMFA(userId: string) {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp'
  });
  // Returns QR code for authenticator app
  return { data, error };
}

// Verify TOTP during login
export async function verifyMFAChallenge(challenge: string, code: string) {
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: challenge,
    code
  });
  return { data, error };
}
```

---

## 5. Storage Buckets

### Bucket Configuration

```typescript
// RLS policies in supabase.json
{
  "storage": [
    {
      "name": "project-files",
      "public": false,
      "avif_auto_encode": false,
      "allowed_mime_types": [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
        "application/dwg",
        "application/x-autocad-dxf"
      ],
      "file_size_limit": 104857600 // 100MB
    },
    {
      "name": "field-photos",
      "public": false,
      "avif_auto_encode": true,
      "allowed_mime_types": [
        "image/jpeg",
        "image/png",
        "image/webp"
      ],
      "file_size_limit": 52428800 // 50MB
    },
    {
      "name": "avatars",
      "public": false,
      "avif_auto_encode": true,
      "allowed_mime_types": [
        "image/jpeg",
        "image/png"
      ],
      "file_size_limit": 5242880 // 5MB
    },
    {
      "name": "exports",
      "public": false,
      "allowed_mime_types": [
        "application/pdf"
      ],
      "file_size_limit": 157286400 // 150MB
    }
  ]
}
```

#### Bucket Path Structure
```
project-files/{project_id}/{entity_type}/{entity_id}/{file_id}_{filename}
  Example: project-files/proj-123/drawings/draw-456/f789_FloorPlan_Rev2.pdf

field-photos/{project_id}/daily-log/{log_date}/{photo_id}_{filename}
  Example: field-photos/proj-123/daily-log/2026-04-01/ph-789_concrete_pour.jpg

avatars/{user_id}/{avatar_id}_{timestamp}.png

exports/{project_id}/{export_type}/{export_id}_{timestamp}.pdf
  Example: exports/proj-123/daily-log/exp-456_2026-04-01.pdf
```

#### Upload Function
```typescript
export async function uploadFile(
  file: File,
  projectId: string,
  bucket: 'project-files' | 'field-photos' | 'avatars' | 'exports',
  entityType?: string,
  entityId?: string
) {
  const fileId = crypto.randomUUID();
  const timestamp = new Date().getTime();

  let path: string;
  if (bucket === 'project-files') {
    path = `${projectId}/${entityType}/${entityId}/${fileId}_${file.name}`;
  } else if (bucket === 'field-photos') {
    const logDate = new Date().toISOString().split('T')[0];
    path = `${projectId}/daily-log/${logDate}/${fileId}_${file.name}`;
  } else if (bucket === 'avatars') {
    path = `${auth.user().id}/${fileId}_${timestamp}.png`;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });

  if (error) throw error;

  // Return signed URL valid for 1 hour
  const { data: signedUrl } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  return { path, signedUrl };
}
```

#### RLS Policies for Storage
```sql
-- Users can view files in their projects
CREATE POLICY "users_can_view_project_files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND
  (storage.foldername(name))[1] IN (
    SELECT projects.id::TEXT
    FROM projects
    JOIN project_members ON projects.id = project_members.project_id
    WHERE project_members.user_id = auth.uid()
  )
);

-- Users can upload to their project's bucket
CREATE POLICY "users_can_upload_to_project"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files' AND
  (storage.foldername(name))[1] IN (
    SELECT projects.id::TEXT
    FROM projects
    JOIN project_members ON projects.id = project_members.project_id
    WHERE project_members.user_id = auth.uid()
  )
);

-- Users can upload their own avatars
CREATE POLICY "users_can_upload_avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::TEXT
);
```

---

## 6. Realtime Subscriptions

### Tables Needing Realtime

| Table | Reason | Channels |
|-------|--------|----------|
| rfis | Status changes visible immediately | `project:{id}:rfis` |
| rfi_responses | Responses appear live | `project:{id}:rfi_responses` |
| daily_logs | Log entries sync in real-time | `project:{id}:daily_logs` |
| punch_list_items | Status updates visible | `project:{id}:punch_list_items` |
| notifications | Alerts delivered instantly | `user:{id}:notifications` |
| activity_feed | Activity stream updates | `project:{id}:activity_feed` |
| schedule_activities | Progress updates live | `project:{id}:schedule_activities` |
| meetings | New meetings broadcast | `project:{id}:meetings` |
| drawing_markups | Markup annotations appear live | `drawing:{id}:markups` |

### Channel Naming Convention
```typescript
// Project-level subscriptions
project:{project_uuid}:{table_name}
  Example: project:proj-123:rfis

// User-level subscriptions (private)
user:{user_uuid}:{channel_name}
  Example: user:user-456:notifications

// Drawing/entity-specific subscriptions
{entity_type}:{entity_uuid}:markups
  Example: drawing:draw-789:markups

// Presence channels (who's viewing)
presence:{project_uuid}:{entity_type}:{entity_id}
  Example: presence:proj-123:drawing:draw-789
```

### Subscription Hook
```typescript
// src/hooks/useSupabaseRealtimeSubscription.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSupabaseRealtime(
  channel: string,
  onUpdate: (payload: any) => void
) {
  useEffect(() => {
    const subscription = supabase
      .channel(channel)
      .on('postgres_changes', {
        event: '*',
        schema: 'public'
      }, (payload) => {
        onUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channel]);
}

// Usage in component
function RFIList({ projectId }) {
  const [rfis, setRfis] = useState([]);

  useSupabaseRealtime(`project:${projectId}:rfis`, (payload) => {
    if (payload.eventType === 'INSERT') {
      setRfis(prev => [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setRfis(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
    }
  });

  return <div>{/* render rfis */}</div>;
}
```

### Presence Tracking (Who's Viewing)
```typescript
export function usePresence(projectId: string, entityId: string, userId: string) {
  useEffect(() => {
    const presence = supabase.channel(
      `presence:${projectId}:drawing:${entityId}`
    );

    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      console.log('Users viewing:', state);
    });

    presence.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await presence.track({
          user_id: userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    return () => presence.unsubscribe();
  }, [projectId, entityId, userId]);
}
```

---

## 7. Edge Functions

### Function Infrastructure

```typescript
// supabase/functions/{function-name}/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const { projectId, userId, query } = await req.json();

    // Function logic here

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### ai-copilot Function
```typescript
// supabase/functions/ai-copilot/index.ts
// Purpose: Answer user questions with project context

interface AICopilotRequest {
  projectId: string;
  userId: string;
  question: string;
  conversationId?: string;
  context?: {
    activeRFIs?: number;
    openPunchItems?: number;
    budgetStatus?: string;
    scheduleStatus?: string;
  };
}

export async function handleAICopilot(req: AICopilotRequest) {
  // 1. Get project context from DB
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.projectId)
    .single();

  // 2. Get relevant project data
  const { data: rfis } = await supabase
    .from('rfis')
    .select('id, number, title, status')
    .eq('project_id', req.projectId)
    .eq('status', 'open')
    .limit(10);

  // 3. Build context prompt
  const contextPrompt = `
    Project: ${project.name}
    Location: ${project.city}, ${project.state}
    Open RFIs: ${rfis?.length || 0}
    User: ${req.userId}

    ${req.context ? JSON.stringify(req.context) : ''}
  `;

  // 4. Call Anthropic Claude API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `You are a construction project management AI assistant.
        Provide field-first, clear answers suitable for superintendents and project managers.
        Use brief, actionable language. No hyphens in any response.`,
      messages: [
        {
          role: 'user',
          content: `${contextPrompt}\n\nUser question: ${req.question}`
        }
      ]
    })
  });

  const result = await response.json();
  const assistantMessage = result.content[0].text;

  // 5. Save to ai_messages table
  if (req.conversationId) {
    await supabase
      .from('ai_messages')
      .insert({
        conversation_id: req.conversationId,
        role: 'assistant',
        content: assistantMessage,
        metadata: {
          model: 'claude-3-5-sonnet-20241022',
          tokens_used: result.usage.output_tokens,
          latency_ms: Date.now()
        }
      });
  }

  return { response: assistantMessage };
}
```

### ai-rfi-draft Function
```typescript
// supabase/functions/ai-rfi-draft/index.ts
// Purpose: Generate formal RFI text from photo or description

interface RFIDraftRequest {
  projectId: string;
  description?: string;
  imageUrl?: string; // signed URL to field photo
}

export async function handleRFIDraft(req: RFIDraftRequest) {
  const messages = [];

  if (req.imageUrl) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'url',
            url: req.imageUrl
          }
        },
        {
          type: 'text',
          text: 'Analyze this construction site photo and draft a formal RFI (Request for Information). Format: Title, Description (2-3 sentences), Questions (bulleted).'
        }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: `Draft a formal RFI based on this description: "${req.description}".
        Format: Title, Description (2-3 sentences), Questions (bulleted).`
    });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: 'You are an expert construction project manager. Draft concise, professional RFIs suitable for architects and engineers.',
      messages
    })
  });

  const result = await response.json();
  return { rfiDraft: result.content[0].text };
}
```

### ai-daily-summary Function
```typescript
// supabase/functions/ai-daily-summary/index.ts
// Purpose: Summarize the day's activity across all logs

interface DailySummaryRequest {
  projectId: string;
  logDate: string; // YYYY-MM-DD
}

export async function handleDailySummary(req: DailySummaryRequest) {
  // 1. Fetch all daily log data
  const { data: dailyLog } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('project_id', req.projectId)
    .eq('log_date', req.logDate)
    .single();

  const { data: entries } = await supabase
    .from('daily_log_entries')
    .select('*')
    .eq('daily_log_id', dailyLog.id);

  const { data: activities } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('project_id', req.projectId)
    .gte('created_at', `${req.logDate}T00:00:00`)
    .lt('created_at', `${req.logDate}T23:59:59`);

  // 2. Build summary prompt
  const summaryData = {
    weather: dailyLog.weather_description,
    temperature: `${dailyLog.temperature_low}F - ${dailyLog.temperature_high}F`,
    crews: entries.filter(e => e.entry_type === 'labor'),
    equipment: entries.filter(e => e.entry_type === 'equipment'),
    safety: dailyLog.safety_incidents,
    activities: activities.length
  };

  // 3. Generate summary
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      system: 'Summarize construction daily activity in 3-4 sentences. Focus on work completed, weather, safety, and key events.',
      messages: [
        {
          role: 'user',
          content: `Daily log for ${req.logDate}: ${JSON.stringify(summaryData)}`
        }
      ]
    })
  });

  const result = await response.json();
  return { summary: result.content[0].text };
}
```

### ai-schedule-risk Function
```typescript
// supabase/functions/ai-schedule-risk/index.ts
// Purpose: Analyze schedule + weather + crew data for risk predictions

interface ScheduleRiskRequest {
  projectId: string;
  lookAheadDays?: number; // default 14
}

export async function handleScheduleRisk(req: ScheduleRiskRequest) {
  const days = req.lookAheadDays || 14;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  // 1. Get upcoming activities
  const { data: activities } = await supabase
    .from('schedule_activities')
    .select('*')
    .eq('project_id', req.projectId)
    .eq('status', 'planned')
    .lte('planned_start', futureDate.toISOString());

  // 2. Get recent weather patterns
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select('weather_description, temperature_high, temperature_low')
    .eq('project_id', req.projectId)
    .order('log_date', { ascending: false })
    .limit(7);

  // 3. Get crew availability
  const { data: assignments } = await supabase
    .from('crew_assignments')
    .select('crew_id, activity_id, percent_allocation')
    .eq('project_id', req.projectId)
    .gte('assigned_date', new Date().toISOString());

  // 4. Analyze risks
  const riskData = {
    upcomingActivities: activities.length,
    weatherTrend: recentLogs,
    crewAvailability: assignments.length,
    criticalPath: activities.filter(a => a.total_float === 0)
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      system: 'You are a construction risk analyst. Identify schedule risks based on activity duration, weather, crew availability. Be specific.',
      messages: [
        {
          role: 'user',
          content: `Analyze schedule risk for next ${days} days: ${JSON.stringify(riskData)}`
        }
      ]
    })
  });

  const result = await response.json();
  return { risks: result.content[0].text };
}
```

### generate-pay-app Function
```typescript
// supabase/functions/generate-pay-app/index.ts
// Purpose: Create AIA G702/G703 pay application from budget data

interface PayAppGeneratorRequest {
  projectId: string;
  payAppId: string;
}

export async function handleGeneratePayApp(req: PayAppGeneratorRequest) {
  // 1. Fetch pay application
  const { data: payApp } = await supabase
    .from('pay_applications')
    .select('*')
    .eq('id', req.payAppId)
    .single();

  // 2. Fetch line items with budget data
  const { data: lineItems } = await supabase
    .from('pay_app_line_items')
    .select(`
      *,
      budget_line_items(csi_division, description)
    `)
    .eq('pay_application_id', req.payAppId);

  // 3. Generate PDF (use a PDF library like pdfkit)
  // This is pseudocode; actual implementation uses a PDF generator
  const pdf = generateG702Form({
    projectName: payApp.project_name,
    applicationNumber: payApp.application_number,
    periodFrom: payApp.period_from,
    periodTo: payApp.period_to,
    lineItems: lineItems,
    totals: {
      contractSum: payApp.contract_sum_to_date,
      previousPayments: payApp.total_previous_payments,
      currentPayment: payApp.total_payment_requested
    }
  });

  // 4. Upload to storage
  const pdfBuffer = await pdf.toBuffer();
  const fileName = `G702_${payApp.application_number}_${new Date().toISOString().split('T')[0]}.pdf`;

  const { data: fileData } = await supabase.storage
    .from('exports')
    .upload(
      `${req.projectId}/pay-app/${req.payAppId}_${fileName}`,
      pdfBuffer,
      { contentType: 'application/pdf' }
    );

  // 5. Create file record in DB
  const { data: fileRecord } = await supabase
    .from('files')
    .insert({
      project_id: req.projectId,
      file_name: fileName,
      file_type: 'pdf',
      file_size: pdfBuffer.length,
      storage_path: fileData.path,
      bucket: 'exports',
      mime_type: 'application/pdf'
    })
    .select()
    .single();

  return { fileId: fileRecord.id, fileName };
}
```

### webhook-handler Function
```typescript
// supabase/functions/webhook-handler/index.ts
// Purpose: Handle webhooks from external services (Procore, weather APIs, etc.)

serve(async (req) => {
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const signature = req.headers.get('x-webhook-signature');

  // Verify signature
  if (!verifyWebhookSignature(req, signature, webhookSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const { source, event, data } = payload;

  // 1. Procore webhook (RFI, submittal sync)
  if (source === 'procore') {
    if (event === 'rfis.created') {
      // Sync RFI from Procore
      await supabase
        .from('rfis')
        .insert({
          project_id: data.project_id,
          number: data.number,
          title: data.title,
          description: data.description,
          status: mapProcoreStatus(data.status)
        });
    }
  }

  // 2. Weather API webhook
  if (source === 'weather_api') {
    const logDate = new Date().toISOString().split('T')[0];
    await supabase
      .from('daily_logs')
      .update({
        weather_description: data.condition,
        temperature_high: data.temp_high,
        temperature_low: data.temp_low
      })
      .eq('project_id', data.project_id)
      .eq('log_date', logDate);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 8. API Patterns

### Query Patterns with Supabase Client

```typescript
// src/lib/supabase.ts
import { Database } from '@/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

// Typed queries (auto-generated from schema)
export async function fetchRFIs(
  client: SupabaseClient<Database>,
  projectId: string,
  options?: {
    page?: number;
    limit?: number;
    status?: string;
    sort?: 'date_submitted' | 'due_date';
  }
) {
  let query = client
    .from('rfis')
    .select('*, rfi_responses(*)')
    .eq('project_id', projectId)
    .eq('deleted_at', null);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.sort) {
    query = query.order(options.sort, { ascending: false });
  }

  if (options?.limit) {
    const offset = ((options.page || 1) - 1) * options.limit;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;
  return { data, error, count };
}

// Full-text search
export async function searchRFIs(
  client: SupabaseClient<Database>,
  projectId: string,
  searchTerm: string
) {
  const { data, error } = await client
    .from('rfis')
    .select('*')
    .eq('project_id', projectId)
    .textSearch('search_text', `'${searchTerm}':*`)
    .eq('deleted_at', null);

  return { data, error };
}

// Pagination with cursor
export async function fetchRFIsPaginated(
  client: SupabaseClient<Database>,
  projectId: string,
  limit: number = 50,
  cursor?: string
) {
  let query = client
    .from('rfis')
    .select('*')
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to determine if more exist

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (!data) return { data: null, error, hasMore: false, nextCursor: null };

  const hasMore = data.length > limit;
  const items = data.slice(0, limit);
  const nextCursor = items[items.length - 1]?.created_at;

  return { data: items, error, hasMore, nextCursor };
}
```

### Mutation Patterns

```typescript
// Optimistic updates
export async function updateRFIStatus(
  client: SupabaseClient<Database>,
  rfiId: string,
  newStatus: string
) {
  // Return optimistic data immediately
  const optimisticData = { id: rfiId, status: newStatus };

  // Fire mutation in background
  const { data, error } = await client
    .from('rfis')
    .update({ status: newStatus, updated_at: new Date() })
    .eq('id', rfiId)
    .select();

  if (error) {
    // Revert optimistic update on error
    return { error, rollback: optimisticData };
  }

  return { data: data?.[0], error };
}

// Batch insert with error handling
export async function createRFIAttachments(
  client: SupabaseClient<Database>,
  rfiId: string,
  fileIds: string[]
) {
  const attachments = fileIds.map(fileId => ({
    rfi_id: rfiId,
    file_id: fileId,
    attachment_type: 'reference'
  }));

  const { data, error } = await client
    .from('rfi_attachments')
    .insert(attachments)
    .select();

  if (error) throw error;
  return { data };
}

// Transaction pattern (using SQL)
export async function approveSubmittal(
  client: SupabaseClient<Database>,
  submittalId: string,
  approvedBy: string
) {
  const { error } = await client.rpc('approve_submittal', {
    p_submittal_id: submittalId,
    p_approved_by: approvedBy
  });

  if (error) throw error;
}

// Function: approve_submittal (stored in DB)
// CREATE OR REPLACE FUNCTION approve_submittal(
//   p_submittal_id UUID,
//   p_approved_by UUID
// ) AS $$
// BEGIN
//   UPDATE submittals SET status = 'approved', approved_by = p_approved_by, date_approved = NOW() WHERE id = p_submittal_id;
//   INSERT INTO activity_feed (project_id, action_type, entity_type, entity_id, actor_id)
//   SELECT project_id, 'status_changed', 'submittal', p_submittal_id, p_approved_by FROM submittals WHERE id = p_submittal_id;
// END;
// $$ LANGUAGE plpgsql;
```

### Error Handling Pattern

```typescript
export async function safeQuery<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await fn();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Not found' };
      } else if (error.code === '42P01') {
        return { data: null, error: 'Table not found' };
      } else {
        return { data: null, error: error.message };
      }
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

---

## 9. Offline Support Strategy

### Service Worker & IndexedDB

```typescript
// src/serviceWorker/sync.ts
// Offline queue for mutations that can't execute until online

interface OfflineOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private db: IDBDatabase;

  async add(operation: OfflineOperation) {
    const tx = this.db.transaction('operations', 'readwrite');
    const store = tx.objectStore('operations');
    await store.add(operation);
  }

  async getAll(): Promise<OfflineOperation[]> {
    const tx = this.db.transaction('operations', 'readonly');
    const store = tx.objectStore('operations');
    return new Promise(resolve => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
    });
  }

  async remove(id: string) {
    const tx = this.db.transaction('operations', 'readwrite');
    const store = tx.objectStore('operations');
    await store.delete(id);
  }
}

// Listen for online/offline
window.addEventListener('online', async () => {
  const queue = new OfflineQueue();
  const operations = await queue.getAll();

  for (const op of operations) {
    try {
      await executeOperation(op);
      await queue.remove(op.id);
    } catch (error) {
      op.retries++;
      if (op.retries > 3) {
        // Log to conflict log for manual review
        await logConflict(op, error);
        await queue.remove(op.id);
      }
    }
  }
});
```

### Conflict Resolution

```typescript
// Last-write-wins strategy with conflict log
export async function resolveConflict(
  table: string,
  id: string,
  localVersion: any,
  remoteVersion: any
) {
  // Compare timestamps
  const localTime = new Date(localVersion.updated_at).getTime();
  const remoteTime = new Date(remoteVersion.updated_at).getTime();

  const winner = localTime > remoteTime ? localVersion : remoteVersion;
  const loser = localTime > remoteTime ? remoteVersion : localVersion;

  // Log the conflict
  await logConflictDetails({
    table,
    recordId: id,
    winner,
    loser,
    resolution: 'last-write-wins',
    resolvedAt: new Date()
  });

  return { resolved: true, data: winner };
}

// Conflict log table
CREATE TABLE conflict_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  winner_version JSONB NOT NULL,
  loser_version JSONB NOT NULL,
  resolution_strategy VARCHAR(50) NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  manual_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Service Worker Caching

```typescript
// src/serviceWorker/caching.ts
const CACHE_VERSION = 'sitesync-v1';
const CACHE_TABLES = [
  'projects',
  'rfis',
  'submittals',
  'daily_logs',
  'punch_list_items',
  'schedule_activities'
];

// Cache critical data on initial load
async function cacheCriticalData(projectId: string) {
  const cache = await caches.open(CACHE_VERSION);

  for (const table of CACHE_TABLES) {
    const response = await fetch(`/api/cache/${projectId}/${table}`);
    cache.put(`/data/${table}`, response);
  }
}

// Serve from cache when offline, with background sync
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  } else if (event.request.method === 'POST' || event.request.method === 'PATCH') {
    // Queue mutations for sync when online
    event.respondWith(queueMutation(event.request));
  }
});
```

---

## 10. Performance Requirements

### Target Metrics
- **Dashboard Load**: Under 2 seconds (First Contentful Paint)
- **RFI List (1000+ items)**: Under 500ms to interactive
- **Drawing Viewer**: Progressive load with tiles under 200ms per tile
- **Realtime Updates**: Under 200ms from event to UI update

### Optimization Strategies

#### Virtualization for Large Lists
```typescript
// src/components/VirtualizedRFIList.tsx
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

export function VirtualizedRFIList({ projectId }) {
  const [rfis, setRfis] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async (startIndex: number, stopIndex: number) => {
    setIsLoading(true);
    const { data, hasMore: more } = await fetchRFIsPaginated(
      projectId,
      50,
      rfis[rfis.length - 1]?.created_at
    );
    setRfis(prev => [...prev, ...data]);
    setHasMore(more);
    setIsLoading(false);
  };

  return (
    <InfiniteLoader
      isItemLoaded={index => index < rfis.length}
      itemCount={hasMore ? rfis.length + 50 : rfis.length}
      loadMoreItems={loadMore}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          ref={ref}
          height={600}
          itemCount={rfis.length}
          itemSize={80}
          onItemsRendered={onItemsRendered}
          width="100%"
        >
          {({ index, style }) => (
            <RFIRow rfi={rfis[index]} style={style} />
          )}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
}
```

#### Image Optimization
```typescript
// Use WebP with fallback
<picture>
  <source srcSet={signedUrl.replace('.jpg', '.webp')} type="image/webp" />
  <img src={signedUrl} alt="Field photo" />
</picture>

// Lazy load images
<img src={url} loading="lazy" />

// Responsive images with srcset
<img
  srcSet={`${url}?w=400 400w, ${url}?w=800 800w`}
  sizes="(max-width: 600px) 400px, 800px"
/>
```

#### Gzip + CDN Caching
```typescript
// supabase.json: enable compression
{
  "storage": {
    "file_cache_control": {
      "project-files": "public, max-age=3600",
      "field-photos": "public, max-age=86400",
      "avatars": "public, max-age=604800"
    }
  }
}
```

---

## 11. Frontend Integration Pattern

### src/lib/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-client-version': '1.0.0'
      }
    }
  }
);
```

### src/hooks/useSupabase.ts
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRFIs(projectId: string) {
  return useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000 // 5 minutes
  });
}

export function useUpdateRFI(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: any) => {
      const { data, error } = await supabase
        .from('rfis')
        .update(updates)
        .eq('id', updates.id)
        .select();

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
    }
  });
}
```

### src/types/database.ts
```typescript
// Auto-generated from Supabase schema via CLI
// npx supabase gen types typescript --project-id your-project > src/types/database.ts

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          // ... other fields
        };
        Insert: {
          name: string;
          slug: string;
          // ... other fields
        };
        Update: {
          name?: string;
          slug?: string;
          // ... other fields
        };
      };
      rfis: {
        Row: {
          id: string;
          project_id: string;
          number: string;
          title: string;
          status: string;
          // ... other fields
        };
      };
      // ... other tables
    };
  };
};
```

### src/stores/rfiStore.ts (Zustand)
```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type RFI = Database['public']['Tables']['rfis']['Row'];

interface RFIStore {
  rfis: RFI[];
  loading: boolean;
  error: string | null;
  fetchRFIs: (projectId: string) => Promise<void>;
  createRFI: (rfi: RFI) => void;
  updateRFI: (id: string, updates: Partial<RFI>) => void;
}

export const useRFIStore = create<RFIStore>((set) => ({
  rfis: [],
  loading: false,
  error: null,

  fetchRFIs: async (projectId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('rfis')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set({ rfis: data, loading: false });
    }
  },

  createRFI: (rfi: RFI) => {
    set(state => ({ rfis: [...state.rfis, rfi] }));
  },

  updateRFI: (id: string, updates: Partial<RFI>) => {
    set(state => ({
      rfis: state.rfis.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  }
}));
```

---

## Summary

This backend architecture enables SiteSync AI to be a scalable, secure, multi-tenant construction PM platform with:

- **Security**: Row-level security + JWT auth + encrypted storage
- **Scale**: Cursor pagination + virtualization + CDN
- **Reliability**: Soft deletes + audit trails + conflict resolution
- **Intelligence**: Edge Functions for AI features with project context
- **Real-time**: Postgres NOTIFY/LISTEN for live updates
- **Offline**: Service workers + IndexedDB + sync protocol

Every tool described here is production-ready and battle-tested at scale.
