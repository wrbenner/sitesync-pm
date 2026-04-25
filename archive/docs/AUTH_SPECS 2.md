# SiteSync AI Authentication & Authorization Specification

**Version**: 1.0
**Last Updated**: 2026-04-01
**Status**: Production Specification for Code Generation

This is the definitive specification for authentication and authorization in SiteSync AI. An autonomous code evolution engine will use this document to generate backend (Supabase) and frontend (React) code. Every detail here is prescriptive.

---

## 1. Authentication Methods

### 1.1 Email/Password Signup with Email Verification

**Flow**:
1. User submits email and password on signup form
2. POST `/auth/signup` with `{ email, password }`
3. Supabase creates auth user and sends verification email
4. Verification email contains clickable link with `token` parameter
5. User clicks link, frontend exchanges token for session
6. User is logged in and must complete onboarding profile

**Backend (Supabase)**:
- Use native Supabase auth for email/password
- Enable email confirmation requirement in auth settings
- Confirmation email template must include: company logo, project context, call-to-action button

**Frontend Endpoints**:
```
POST /auth/signup
  Body: { email: string, password: string }
  Response: { user_id: uuid, email: string, requiresEmailVerification: true }

POST /auth/verify-email
  Body: { token: string }
  Response: { accessToken: string, refreshToken: string, user: User }

POST /auth/resend-verification
  Body: { email: string }
  Response: { success: boolean }
```

### 1.2 Magic Link (Passwordless) for Field Crews

**Flow**:
1. Field crew member enters email on login page
2. POST `/auth/magic-link` with `{ email }`
3. System sends magic link (valid 15 minutes)
4. User clicks link in email, automatically logs in
5. Session persists via refresh token

**Backend (Supabase)**:
- Use Supabase auth's passwordless email flow
- Magic link expiration: 15 minutes
- Link redirects to `/auth/callback?token={SESSION_TOKEN}&type=magiclink`

**Frontend Endpoints**:
```
POST /auth/magic-link
  Body: { email: string }
  Response: { success: boolean, message: string }

GET /auth/callback
  Query: { token: string, type: 'magiclink' | 'email_verification' }
  Behavior: Exchanges token for session, redirects to /dashboard
```

### 1.3 Google OAuth for Office Teams

**Flow**:
1. User clicks "Sign in with Google" on login page
2. Redirects to Google consent screen
3. Google returns auth code
4. Backend exchanges code for Google ID token
5. Supabase creates auth user linked to Google account
6. User is logged in

**Backend (Supabase)**:
- Configure Google OAuth provider in Supabase dashboard
- Client ID and Client Secret configured in Supabase settings
- Redirect URI: `{FRONTEND_URL}/auth/callback`

**Frontend Endpoints**:
```
POST /auth/google
  Body: { idToken: string (from Google SDK) }
  Response: { accessToken: string, refreshToken: string, user: User }

GET /auth/callback
  Query: { code: string, state: string }
  Behavior: Handles OAuth redirect from Google
```

**Google OAuth Configuration**:
- Scopes: `openid email profile`
- Auto-create user profile on first login with Google account email
- Link existing email account if email matches (optional prompt)

### 1.4 Session Persistence: 30 Day Refresh Tokens

**Tokens**:
- **Access Token**: JWT with 1 hour expiration. Contains `sub` (user_id), `role`, `project_ids`, `exp`.
- **Refresh Token**: Opaque token stored in secure HTTP-only cookie. Valid for 30 days. Automatically refreshed on `/auth/refresh`.

**Storage**:
- Access token: Zustand store (in-memory)
- Refresh token: HTTP-only secure cookie set by backend

**Refresh Flow**:
1. Access token expires (1 hour)
2. On any API call, check if token expired
3. If expired, POST `/auth/refresh` with refresh token (automatic via cookie)
4. Backend returns new access token
5. Zustand store updated with new token
6. Request retried with new token

**Backend Implementation**:
```sql
-- Session table for tracking active sessions
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Index for fast lookups
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

**Endpoints**:
```
POST /auth/refresh
  Cookies: { refreshToken: string }
  Response: { accessToken: string, expiresIn: 3600 }

POST /auth/logout
  Body: { refreshToken?: string }
  Behavior: Revokes all sessions for user (optional: single session)
  Response: { success: boolean }

GET /auth/sessions
  Response: { sessions: Array<{ id, createdAt, lastUsedAt, ipAddress, userAgent }> }
  Behavior: Lists all active sessions for current user
```

### 1.5 MFA via TOTP for Admin Roles

**Flow**:
1. Admin enables MFA in settings
2. System generates TOTP secret (shared with authenticator app)
3. User scans QR code with Google Authenticator, Authy, etc.
4. User enters 6-digit code to confirm setup
5. On next login, user prompted for TOTP code before session created

**Backend (Supabase)**:
- Use `speakeasy` or similar TOTP library for backend
- Store `totp_secret` encrypted in `user_profiles` table
- Store `mfa_enabled_at` timestamp for audit
- Backup codes (10 single-use codes) generated on setup

**Backend Tables**:
```sql
ALTER TABLE user_profiles ADD COLUMN (
  totp_secret TEXT, -- encrypted with master key
  mfa_enabled_at TIMESTAMP WITH TIME ZONE,
  backup_codes JSONB -- array of hashed codes
);
```

**Endpoints**:
```
POST /auth/mfa/setup
  Response: {
    secret: string (base32),
    qrCode: string (data URI),
    backupCodes: string[]
  }

POST /auth/mfa/verify-setup
  Body: { totpCode: string }
  Response: { success: boolean, backupCodes?: string[] }

POST /auth/mfa/verify-login
  Body: { totpCode: string, sessionToken: string }
  Response: { accessToken: string, refreshToken: string }

POST /auth/mfa/disable
  Body: { password: string, totpCode: string }
  Response: { success: boolean }

POST /auth/mfa/backup-codes
  Response: { newBackupCodes: string[] }
```

---

## 2. User Roles (Construction-Specific)

**Role Hierarchy**: Owner > GC Admin > Project Manager > Superintendent > Foreman > Subcontractor / Architect / Inspector / Read-Only

All roles are scoped to a **project**. A user can have different roles across different projects.

### 2.1 Owner/Developer

**Context**: The person or entity paying for the project and bearing financial risk.

**Responsibilities**: Approves major decisions, views financial performance, tracks progress.

**Permissions**:
- View project dashboard, progress, schedule, budget
- View financial reports (cost to date, forecasted cost, change order tracking)
- Approve/reject change orders
- View RFIs and submittals (read-only)
- View daily logs (read-only, aggregated)
- Cannot edit RFIs, submittals, daily logs, or crew assignments
- Cannot modify project settings directly (delegates to GC Admin)
- Can revoke user access to project

**Cannot do**:
- Create or edit RFIs, change orders, daily logs
- Manage crews or assign tasks
- Upload drawings or edit schedule
- Access AI Copilot (no field work context)

---

### 2.2 General Contractor Admin

**Context**: Management level at the GC company. Full control over project execution.

**Permissions**:
- Full access to all project features
- Manage users: invite, remove, change roles
- Manage project settings: name, description, team, dates
- Create/edit/delete RFIs, submittals, change orders
- Create/edit/delete daily logs and crew assignments
- Upload and manage drawings
- Edit schedule and budget
- View all financial data
- Access AI Copilot
- Manage subcontractor access and data sharing
- View audit logs
- Delete punch list items and close them
- Manage meetings and distribute notes
- Access all file management

**Cannot do**:
- Manage billing or contract terms (organization level)
- Remove the Owner from the project
- Access other projects (organization or role-based restriction)

---

### 2.3 Project Manager

**Context**: Day-to-day coordination. Manages documents, change tracking, and scheduling.

**Permissions**:
- View dashboard and KPIs
- Create/edit/close RFIs
- Create/edit/close submittals
- Create/edit/approve change orders (within delegation limit, if set)
- Edit schedule and milestones
- View and edit budget (cannot delete line items, cannot approve final budget)
- View daily logs (read-only)
- Upload drawings
- View crews and assignments (read-only)
- Create and manage meetings
- Upload and organize files
- Access AI Copilot
- Create punch list items
- Cannot directly edit team member roles or access settings

---

### 2.4 Superintendent

**Context**: On-site daily operations. Field focus, limited office access.

**Permissions**:
- Create daily logs for all crews
- View and assign punch list items
- Create field capture entries (photos, voice, progress)
- View schedule and crew assignments
- View RFIs (can comment, cannot close)
- View submittals (can comment, cannot close)
- View budget status only (summary, not detailed costs)
- Create crew assignments and manage on-site teams
- View drawings (read-only)
- Create informal meetings/stand-ups
- Access AI Copilot (for field context)
- View files (read-only)

**Cannot do**:
- Edit RFIs or submittals
- Approve change orders
- Modify schedule (can only view)
- View financial details or cost data
- Manage project-level users or roles
- Delete items (can only mark complete)

---

### 2.5 Foreman

**Context**: Crew-level supervision. Only sees their assigned team.

**Permissions**:
- Create/edit daily logs for their assigned crew only
- View and acknowledge punch list items assigned to their crew
- View schedule for their trade
- View crew assignments for their team
- Field capture for their crew
- Cannot view other crews' data, budget, or financial info
- Cannot create RFIs or submittals
- Cannot access drawings or change orders

**Cannot do**:
- View other crews' information
- Create RFIs, submittals, or change orders
- Modify schedule
- Access budget or financial data
- Access AI Copilot (role too restricted)
- View project-wide meetings

---

### 2.6 Subcontractor

**Context**: Trade contractor with limited scope. Sees only their own work.

**Permissions**:
- View only RFIs, submittals, and change orders assigned to their company
- Submit daily logs for their crew
- View punch list items assigned to their crew
- Field capture for their crew
- View schedule (only dates and milestones relevant to their trade)
- Cannot view other subcontractors' data
- Cannot view detailed budget or cost information
- Cannot view drawings (unless explicitly shared)

**Cannot do**:
- Create RFIs, submittals, or change orders
- View other subcontractors' work or data
- Access crew management
- Modify schedule or budget
- Access AI Copilot
- View meetings or minutes (unless explicitly invited)

---

### 2.7 Architect/Engineer

**Context**: Design consultants. Manage submissions and responses.

**Permissions**:
- View and respond to RFIs
- Review and comment on submittals
- Upload and manage drawings
- View schedule (read-only)
- View field photos (for reference)
- Cannot access budget or financial data
- Cannot create daily logs or crew assignments
- Cannot approve change orders
- Cannot access AI Copilot

**Cannot do**:
- Create change orders
- View financial data
- Modify schedule
- Manage crews
- View punch lists or daily logs
- Access meetings (unless invited)

---

### 2.8 Inspector

**Context**: Third-party inspection and compliance.

**Permissions**:
- View daily logs (read-only, all crews)
- View punch list items (read-only)
- Add inspection reports and comments
- View photos and field capture (read-only)
- View specific documents (if shared)
- Cannot modify any data
- Cannot access budget or financial data
- Cannot edit or close punch lists

**Cannot do**:
- Create or edit any items
- View detailed crew information
- Access budget or schedule
- Create RFIs or submittals
- Access AI Copilot
- Manage files

---

### 2.9 Read-Only / Client

**Context**: Client visibility. High-level progress tracking.

**Permissions**:
- View dashboard (summary only)
- View progress photos
- View high-level schedule
- View budget summary (cost to date vs. budget)
- Cannot access any detailed data
- Cannot interact with documents or tools
- Cannot comment or create items

**Cannot do**:
- Create or edit anything
- Access detailed schedule or budget
- View daily logs or crew details
- Create RFIs or submittals
- Access AI Copilot

---

## 3. Permission Matrix

**Resources** (rows): Feature areas in the app
**Roles** (columns): User roles
**Cells**: Permission level

| Resource | Owner | GC Admin | PM | Super | Foreman | Sub | Arch/Eng | Inspector | Read-Only |
|---|---|---|---|---|---|---|---|---|---|
| **RFI** | read | admin | write | read,comment | none | read,write* | write | read | none |
| **Submittal** | read | admin | write | read,comment | none | read,write* | write | read | none |
| **Change Order** | read,approve | admin | write | read | none | read* | none | none | none |
| **Daily Log** | read | admin | read | write | write* | write* | none | read | none |
| **Budget** | read | admin | read,write | read_summary | none | none | none | none | read_summary |
| **Schedule** | read | admin | write | read | read | read | read | none | read |
| **Drawings** | read | admin | write | read | none | none | write | read | none |
| **Punch List** | read | admin | write | read,assign | read,assign | read,assign* | none | read | none |
| **Crews** | read | admin | read | write | read* | none | none | none | none |
| **Meetings** | read | admin | write | read,write | none | none | read | none | none |
| **Files** | read | admin | write | read | read* | read* | write | read | none |
| **AI Copilot** | none | admin | write | write | none | none | none | none | none |
| **User Management** | revoke | admin | none | none | none | none | none | none | none |
| **Project Settings** | none | admin | none | none | none | none | none | none | none |
| **Audit Logs** | read | admin | none | none | none | none | none | none | none |

**Legend**:
- `none`: No access
- `read`: View only
- `write`: Create, edit, view
- `admin`: Full control including delete
- `read_summary`: Read aggregated/summary data only
- `read,comment`: Read and add comments but not edit
- `write*`: Write only own records (crew-scoped or company-scoped)
- `read,write*`: Assigned items only
- `read,assign`: Read and reassign to others

---

## 4. Row-Level Security (RLS) Implementation

**Architecture**: Supabase Postgres with RLS policies. Every table has RLS enabled. JWT claims (`sub`, `role`, `project_ids`) determine access.

### 4.1 Core Auth Tables

```sql
-- User profiles (one per auth.user)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  trade TEXT, -- For foreman/subcontractor context
  avatar_url TEXT,
  totp_secret TEXT, -- Encrypted
  mfa_enabled_at TIMESTAMP WITH TIME ZONE,
  backup_codes JSONB, -- Array of hashed codes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project membership and role assignment
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'owner', 'gc_admin', 'project_manager', 'superintendent',
    'foreman', 'subcontractor', 'architect_engineer', 'inspector', 'read_only'
  )),
  company_id UUID REFERENCES companies(id), -- For subcontractor/foreman context
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Audit log for all permission changes
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'invite', 'role_change', 'revoke', etc.
  resource_type TEXT, -- 'user', 'project', 'rfi', etc.
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_project ON audit_log(project_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

### 4.2 Function to Get User Role in Project

```sql
-- Helper function: get user's role in a project
CREATE OR REPLACE FUNCTION get_user_role_in_project(
  p_user_id UUID,
  p_project_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM project_members
  WHERE user_id = p_user_id
    AND project_id = p_project_id
    AND status = 'accepted';
  RETURN COALESCE(v_role, 'none');
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: check if user can access a resource based on role
CREATE OR REPLACE FUNCTION can_user_access_resource(
  p_user_id UUID,
  p_project_id UUID,
  p_resource_type TEXT,
  p_permission TEXT -- 'read', 'write', 'admin'
) RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_can_access BOOLEAN;
BEGIN
  v_role := get_user_role_in_project(p_user_id, p_project_id);

  -- Define permission matrix (simplified)
  v_can_access := CASE
    -- admin can do everything
    WHEN v_role IN ('owner', 'gc_admin') THEN true

    -- Permission-specific checks
    WHEN p_permission = 'read' THEN
      v_role NOT IN ('none')
    WHEN p_permission = 'write' THEN
      v_role IN ('owner', 'gc_admin', 'project_manager', 'superintendent', 'architect_engineer')
    WHEN p_permission = 'admin' THEN
      v_role IN ('owner', 'gc_admin')
    ELSE false
  END;

  RETURN v_can_access;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 4.3 RLS Policies for Projects Table

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: Enable on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read projects they are members of
CREATE POLICY read_project_as_member ON projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
  );

-- Policy: Only GC Admin or Owner can update project
CREATE POLICY update_project_as_admin ON projects
  FOR UPDATE
  USING (
    get_user_role_in_project(auth.uid(), id) IN ('owner', 'gc_admin')
  );

-- Policy: Only Owner can delete project
CREATE POLICY delete_project_as_owner ON projects
  FOR DELETE
  USING (
    get_user_role_in_project(auth.uid(), id) = 'owner'
  );
```

### 4.4 RLS Policies for RFIs

```sql
CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL, -- "RFI-001"
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending_response', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_company_id UUID REFERENCES companies(id), -- For subcontractor RFIs
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE,
  response TEXT,
  response_by UUID REFERENCES auth.users(id),
  response_date TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;

-- Policy: Read RFI if you're in the project
-- AND either: full access role, assigned to you, or assigned to your company
CREATE POLICY read_rfi AS $$
  SELECT DISTINCT
    rfis.*
  FROM rfis
  WHERE project_id = (
    SELECT id FROM projects WHERE rfis.project_id = projects.id
  )
  AND (
    -- GC Admin, Owner, PM, Super, Arch/Eng can read all
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent', 'architect_engineer'
    )
    -- Subcontractor can read RFIs assigned to their company
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'subcontractor'
      AND assigned_company_id = (
        SELECT company_id FROM project_members
        WHERE user_id = auth.uid() AND project_id = rfis.project_id
      )
    )
  )
$$ AS $$
  SELECT true;
$$;

-- Policy: Create RFI if you're GC Admin, Owner, or PM
CREATE POLICY create_rfi ON rfis
  FOR INSERT
  WITH CHECK (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager'
    )
  );

-- Policy: Update RFI if you're GC Admin/PM OR assigned response role (Arch/Eng)
CREATE POLICY update_rfi ON rfis
  FOR UPDATE
  USING (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager'
    )
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'architect_engineer'
      AND status = 'pending_response'
    )
  );

-- Policy: Delete RFI if GC Admin or Owner
CREATE POLICY delete_rfi ON rfis
  FOR DELETE
  USING (
    get_user_role_in_project(auth.uid(), project_id) IN ('owner', 'gc_admin')
  );
```

### 4.5 RLS Policies for Daily Logs

```sql
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  crew_id UUID REFERENCES crews(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  summary TEXT,
  weather TEXT,
  temperature_high INTEGER,
  temperature_low INTEGER,
  delays_text TEXT,
  safety_incidents TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, log_date, crew_id)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Read daily logs if in project AND authorized role
CREATE POLICY read_daily_log ON daily_logs
  FOR SELECT
  USING (
    -- GC Admin, Owner, PM, Super, Inspector, Owner can read all
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent', 'inspector'
    )
    -- Foreman can read logs for their crew
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'foreman'
      AND crew_id = (
        SELECT crew_id FROM crew_members
        WHERE user_id = auth.uid() AND is_lead = true
      )
    )
    -- Subcontractor can read logs for their crew
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'subcontractor'
      AND crew_id IN (
        SELECT id FROM crews
        WHERE company_id = (
          SELECT company_id FROM project_members
          WHERE user_id = auth.uid() AND project_id = daily_logs.project_id
        )
      )
    )
  );

-- Policy: Create/update daily log if you're the creator (Superintendent/Foreman)
-- OR GC Admin
CREATE POLICY write_daily_log ON daily_logs
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR get_user_role_in_project(auth.uid(), project_id) IN ('owner', 'gc_admin')
  );

CREATE POLICY insert_daily_log ON daily_logs
  FOR INSERT
  WITH CHECK (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'superintendent', 'foreman', 'subcontractor'
    )
  );
```

### 4.6 RLS Policies for Punch Lists

```sql
CREATE TABLE punch_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_company_id UUID REFERENCES companies(id),
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE punch_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Read punch list if authorized
CREATE POLICY read_punch_list ON punch_lists
  FOR SELECT
  USING (
    -- GC Admin, Owner, PM, Super can see all
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent', 'inspector'
    )
    -- Foreman can see assigned punch lists
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'foreman'
      AND assigned_to = auth.uid()
    )
    -- Subcontractor can see assigned punch lists
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'subcontractor'
      AND assigned_company_id = (
        SELECT company_id FROM project_members
        WHERE user_id = auth.uid() AND project_id = punch_lists.project_id
      )
    )
  );

-- Policy: Update punch list status if assigned to you or GC Admin
CREATE POLICY update_punch_list ON punch_lists
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent'
    )
  );

-- Policy: Create punch list if PM, Super, or GC Admin
CREATE POLICY insert_punch_list ON punch_lists
  FOR INSERT
  WITH CHECK (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent'
    )
  );

-- Policy: Delete punch list if GC Admin
CREATE POLICY delete_punch_list ON punch_lists
  FOR DELETE
  USING (
    get_user_role_in_project(auth.uid(), project_id) = 'gc_admin'
  );
```

### 4.7 RLS Policies for Budget & Change Orders

```sql
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Read change order based on role
CREATE POLICY read_change_order ON change_orders
  FOR SELECT
  USING (
    -- Owner can read all (approval required)
    get_user_role_in_project(auth.uid(), project_id) = 'owner'
    -- GC Admin and PM can read all
    OR get_user_role_in_project(auth.uid(), project_id) IN ('gc_admin', 'project_manager')
    -- Subcontractor can read only their assigned change orders
    OR (
      get_user_role_in_project(auth.uid(), project_id) = 'subcontractor'
      AND requested_by = auth.uid()
    )
  );

-- Policy: Create change order if PM or GC Admin
CREATE POLICY insert_change_order ON change_orders
  FOR INSERT
  WITH CHECK (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'gc_admin', 'project_manager'
    )
  );

-- Policy: Update change order if GC Admin (approve) or PM (edit before approval)
CREATE POLICY update_change_order ON change_orders
  FOR UPDATE
  USING (
    get_user_role_in_project(auth.uid(), project_id) IN ('gc_admin', 'project_manager')
    AND status = 'pending'
  );

-- Policy: Approve change order if Owner
CREATE POLICY approve_change_order ON change_orders
  FOR UPDATE
  USING (
    get_user_role_in_project(auth.uid(), project_id) = 'owner'
    AND status = 'pending'
  );
```

### 4.8 RLS Policies for Budget View

```sql
CREATE TABLE budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  budgeted_amount NUMERIC(12, 2) NOT NULL,
  spent_amount NUMERIC(12, 2) DEFAULT 0,
  forecast_amount NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: Read budget based on role
CREATE POLICY read_budget_line_item ON budget_line_items
  FOR SELECT
  USING (
    -- Owner, GC Admin, PM can read all details
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager'
    )
    -- Superintendent can read summary only (handled in view)
    OR get_user_role_in_project(auth.uid(), project_id) = 'superintendent'
  );

-- Policy: Update budget if GC Admin only
CREATE POLICY update_budget_line_item ON budget_line_items
  FOR UPDATE
  USING (
    get_user_role_in_project(auth.uid(), project_id) = 'gc_admin'
  );
```

### 4.9 RLS Policies for Drawings & Files

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_drawing BOOLEAN DEFAULT false
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Policy: Read file if you're in the project AND authorized
CREATE POLICY read_file ON files
  FOR SELECT
  USING (
    -- GC Admin, Owner, PM, Arch/Eng, Inspector can read all files
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'superintendent',
      'architect_engineer', 'inspector'
    )
    -- Foreman and Subcontractor can read drawings
    OR (
      is_drawing = true
      AND get_user_role_in_project(auth.uid(), project_id) IN (
        'foreman', 'subcontractor'
      )
    )
  );

-- Policy: Upload file if PM, Arch/Eng, or GC Admin
CREATE POLICY upload_file ON files
  FOR INSERT
  WITH CHECK (
    get_user_role_in_project(auth.uid(), project_id) IN (
      'owner', 'gc_admin', 'project_manager', 'architect_engineer'
    )
  );

-- Policy: Delete file if uploaded by you (or GC Admin)
CREATE POLICY delete_file ON files
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR get_user_role_in_project(auth.uid(), project_id) = 'gc_admin'
  );
```

### 4.10 Storage RLS for File Access

```sql
-- Supabase Storage bucket RLS policy
-- Bucket: project-files

CREATE POLICY "read_project_files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM files
      WHERE storage_path = storage.objects.name
        AND (
          get_user_role_in_project(auth.uid(), project_id) IN (
            'owner', 'gc_admin', 'project_manager', 'superintendent',
            'architect_engineer', 'inspector'
          )
          OR (
            is_drawing = true
            AND get_user_role_in_project(auth.uid(), project_id) IN (
              'foreman', 'subcontractor'
            )
          )
        )
    )
  );

CREATE POLICY "upload_project_files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "delete_project_files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM files
      WHERE storage_path = storage.objects.name
        AND (
          uploaded_by = auth.uid()
          OR get_user_role_in_project(auth.uid(),
            (SELECT project_id FROM files WHERE storage_path = storage.objects.name LIMIT 1))
            = 'gc_admin'
        )
    )
  );
```

---

## 5. Frontend Auth Flow

### 5.1 TypeScript Interfaces & Types

```typescript
// types/auth.ts

export type UserRole =
  | 'owner'
  | 'gc_admin'
  | 'project_manager'
  | 'superintendent'
  | 'foreman'
  | 'subcontractor'
  | 'architect_engineer'
  | 'inspector'
  | 'read_only';

export type Permission = 'read' | 'write' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  company?: string;
  phone?: string;
  trade?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: UserRole;
  companyId?: string;
  invitedAt: string;
  acceptedAt?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'revoked';
}

export interface AuthContextType {
  // State
  user: User | null;
  loading: boolean;
  error: string | null;
  accessToken: string | null;
  userRoles: Map<string, UserRole>; // projectId -> role

  // Actions
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  verifyMFA: (totpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Permissions
  hasRole: (projectId: string, role: UserRole | UserRole[]) => boolean;
  canAccess: (projectId: string, resource: string, permission: Permission) => boolean;
  getRoleInProject: (projectId: string) => UserRole | null;
}

export interface SessionToken {
  accessToken: string;
  refreshToken: string; // Stored in secure HTTP-only cookie
  expiresIn: number; // Seconds
  expiresAt: number; // Unix timestamp
}

export interface MFASetupResponse {
  secret: string; // Base32 encoded
  qrCode: string; // Data URI
  backupCodes: string[]; // Human-readable
}
```

### 5.2 Zustand Auth Store

```typescript
// store/authStore.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AuthStore extends AuthContextType {
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setUserRole: (projectId: string, role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        loading: false,
        error: null,
        accessToken: null,
        userRoles: new Map(),

        setUser: (user) => set({ user }),
        setAccessToken: (accessToken) => set({ accessToken }),
        setUserRole: (projectId, role) =>
          set((state) => {
            const newRoles = new Map(state.userRoles);
            newRoles.set(projectId, role);
            return { userRoles: newRoles };
          }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),

        hasRole: (projectId, roles) => {
          const userRole = get().userRoles.get(projectId);
          const roleArray = Array.isArray(roles) ? roles : [roles];
          return roleArray.includes(userRole as UserRole);
        },

        getRoleInProject: (projectId) => {
          return get().userRoles.get(projectId) || null;
        },

        canAccess: (projectId, resource, permission) => {
          const userRole = get().userRoles.get(projectId);
          if (!userRole) return false;

          // Permission matrix (simplified, full version in permission config)
          const permissionMatrix: Record<UserRole, Record<string, Permission[]>> = {
            gc_admin: {
              rfi: ['read', 'write', 'admin'],
              daily_log: ['read', 'write', 'admin'],
              // ... all resources with admin
            },
            project_manager: {
              rfi: ['read', 'write'],
              daily_log: ['read'],
              schedule: ['read', 'write'],
              // ...
            },
            // ... rest of matrix
          };

          const permissions = permissionMatrix[userRole]?.[resource] || [];
          return permissions.includes(permission);
        },

        signUpWithEmail: async (email, password) => {
          set({ loading: true, error: null });
          try {
            const response = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            if (!response.ok) throw new Error('Signup failed');
            // Redirect to verification or magic link flow
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        signInWithEmail: async (email, password) => {
          set({ loading: true, error: null });
          try {
            const response = await fetch('/api/auth/signin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            set({
              accessToken: data.accessToken,
              user: data.user,
              userRoles: new Map(data.roles),
            });
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        signInWithMagicLink: async (email) => {
          set({ loading: true, error: null });
          try {
            await fetch('/api/auth/magic-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            // Notify user to check email
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        signInWithGoogle: async (idToken) => {
          set({ loading: true, error: null });
          try {
            const response = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            set({
              accessToken: data.accessToken,
              user: data.user,
              userRoles: new Map(data.roles),
            });
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        verifyMFA: async (totpCode) => {
          set({ loading: true, error: null });
          try {
            const response = await fetch('/api/auth/mfa/verify-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ totpCode }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            set({
              accessToken: data.accessToken,
              user: data.user,
              userRoles: new Map(data.roles),
            });
          } catch (error) {
            set({ error: (error as Error).message });
          } finally {
            set({ loading: false });
          }
        },

        refreshSession: async () => {
          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include', // Include cookie
            });
            if (!response.ok) {
              set({ accessToken: null, user: null });
              return;
            }
            const data = await response.json();
            set({ accessToken: data.accessToken });
          } catch (error) {
            set({ accessToken: null, user: null });
          }
        },

        logout: async () => {
          set({ loading: true });
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
            });
          } finally {
            set({
              user: null,
              accessToken: null,
              userRoles: new Map(),
              loading: false,
            });
          }
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          accessToken: state.accessToken,
          user: state.user,
          userRoles: Array.from(state.userRoles.entries()), // Serialize Map
        }),
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as any),
          userRoles: new Map(
            (persistedState as any)?.userRoles || []
          ),
        }),
      }
    )
  )
);
```

### 5.3 Protected Route Component

```typescript
// components/ProtectedRoute.tsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  projectId?: string;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  projectId,
  fallback,
}) => {
  const { user, hasRole, loading } = useAuthStore();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && projectId) {
    if (!hasRole(projectId, requiredRole)) {
      return fallback || <Navigate to="/dashboard" />;
    }
  }

  return <>{children}</>;
};
```

### 5.4 Login Page Component

```typescript
// pages/Login.tsx

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'magiclink'>('password');
  const [totpCode, setTotpCode] = useState('');
  const [requiresMFA, setRequiresMFA] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    signInWithEmail,
    signInWithMagicLink,
    signInWithGoogle,
    verifyMFA,
    loading,
    error,
  } = useAuthStore();

  // Handle OAuth callback
  React.useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Exchange token for session
      handleAuthCallback(token);
    }
  }, [searchParams]);

  const handleAuthCallback = async (token: string) => {
    try {
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (data.requiresMFA) {
        setRequiresMFA(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Auth callback failed', err);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMethod === 'password') {
      await signInWithEmail(email, password);
      navigate('/dashboard');
    } else {
      await signInWithMagicLink(email);
      // Show "check email" message
    }
  };

  const handleGoogleLogin = async () => {
    // Use Google SDK to get ID token, then call signInWithGoogle
    // This is pseudocode; actual implementation depends on Google SDK setup
    const idToken = await getGoogleIdToken();
    await signInWithGoogle(idToken);
    navigate('/dashboard');
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyMFA(totpCode);
    navigate('/dashboard');
  };

  if (requiresMFA) {
    return (
      <div className="login-container">
        <h1>Enter MFA Code</h1>
        <form onSubmit={handleMFASubmit}>
          <input
            type="text"
            placeholder="000000"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            maxLength={6}
          />
          <button type="submit" disabled={loading}>
            Verify
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1>Sign In to SiteSync</h1>

      <form onSubmit={handleEmailLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {loginMethod === 'password' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        <label>
          <input
            type="radio"
            value="password"
            checked={loginMethod === 'password'}
            onChange={() => setLoginMethod('password')}
          />
          Password
        </label>
        <label>
          <input
            type="radio"
            value="magiclink"
            checked={loginMethod === 'magiclink'}
            onChange={() => setLoginMethod('magiclink')}
          />
          Magic Link (no password)
        </label>

        <button type="submit" disabled={loading}>
          {loginMethod === 'password' ? 'Sign In' : 'Send Magic Link'}
        </button>

        {error && <p className="error">{error}</p>}
      </form>

      <hr />

      <button onClick={handleGoogleLogin} disabled={loading}>
        Sign In with Google
      </button>
    </div>
  );
};

export default LoginPage;
```

### 5.5 API Request Interceptor with Token Refresh

```typescript
// api/client.ts

import { useAuthStore } from '../store/authStore';

export const createApiClient = () => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const makeRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> => {
    const { accessToken, refreshSession, logout } = useAuthStore.getState();

    let headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Send cookies
    });

    // Token expired, try refresh
    if (response.status === 401) {
      await refreshSession();
      const newToken = useAuthStore.getState().accessToken;

      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        // Refresh failed, logout
        await logout();
        window.location.href = '/login';
      }
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  };

  return {
    get: (endpoint: string) =>
      makeRequest(endpoint, { method: 'GET' }),
    post: (endpoint: string, body: any) =>
      makeRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint: string, body: any) =>
      makeRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint: string) =>
      makeRequest(endpoint, { method: 'DELETE' }),
  };
};

export const api = createApiClient();
```

---

## 6. Invite Flow

### 6.1 Backend Invite Endpoint

```typescript
// POST /api/projects/:projectId/invite

export interface InviteUserRequest {
  email: string;
  role: UserRole;
  company?: string;
  trade?: string;
}

export interface InviteUserResponse {
  success: boolean;
  projectMemberId: string;
  inviteLink: string;
  invitationEmail: string;
}

// Controller logic:
export async function inviteUser(req: Request, res: Response) {
  const { projectId } = req.params;
  const { email, role, company, trade } = req.body as InviteUserRequest;
  const inviterId = req.user.id;

  // 1. Verify inviter is GC Admin or Owner
  const inviterRole = await getProjectRole(inviterId, projectId);
  if (!['owner', 'gc_admin'].includes(inviterRole)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Check if user already exists
  let user = await getUserByEmail(email);
  if (!user) {
    // Create placeholder user (no password yet)
    user = await createPlaceholderUser(email);
  }

  // 3. Create project_members record with 'pending' status
  const invitation = await db.insert('project_members').values({
    projectId,
    userId: user.id,
    role,
    companyId: company ? await getOrCreateCompany(company) : null,
    invitedAt: new Date(),
    invitedBy: inviterId,
    status: 'pending',
  });

  // 4. Generate magic link token
  const token = await generateMagicLinkToken(user.id, projectId);
  const inviteLink = `${process.env.FRONTEND_URL}/auth/accept-invite?token=${token}`;

  // 5. Send email
  await sendInviteEmail({
    to: email,
    inviteLink,
    projectName: await getProjectName(projectId),
    role,
    inviterName: inviterId,
  });

  // 6. Audit log
  await logAudit({
    userId: inviterId,
    projectId,
    action: 'invite',
    resourceType: 'user',
    resourceId: user.id,
    newValue: { email, role, status: 'pending' },
  });

  res.json({
    success: true,
    projectMemberId: invitation.id,
    inviteLink,
    invitationEmail: email,
  });
}
```

### 6.2 Invite Acceptance & Onboarding

```typescript
// GET /api/auth/accept-invite?token={token}
// Frontend: pages/AcceptInvite.tsx

export const AcceptInvitePage: React.FC = () => {
  const [token] = useSearchParams().get('token');
  const [step, setStep] = useState<'verify' | 'profile' | 'complete'>('verify');
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    company: '',
    trade: '',
  });

  React.useEffect(() => {
    // Verify token validity
    verifyInviteToken(token);
  }, [token]);

  const handleProfileSubmit = async () => {
    // 1. Complete profile
    await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        ...profileData,
      }),
    });

    // 2. Accept project membership
    await fetch('/api/projects/:projectId/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    setStep('complete');
  };

  if (step === 'verify') {
    return <div>Verifying invitation...</div>;
  }

  if (step === 'profile') {
    return (
      <div className="invite-form">
        <h1>Welcome to SiteSync</h1>
        <form onSubmit={() => handleProfileSubmit()}>
          <input
            type="text"
            placeholder="Full Name"
            value={profileData.fullName}
            onChange={(e) =>
              setProfileData({ ...profileData, fullName: e.target.value })
            }
            required
          />
          <input
            type="tel"
            placeholder="Phone"
            value={profileData.phone}
            onChange={(e) =>
              setProfileData({ ...profileData, phone: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Company"
            value={profileData.company}
            onChange={(e) =>
              setProfileData({ ...profileData, company: e.target.value })
            }
          />
          <select
            value={profileData.trade}
            onChange={(e) =>
              setProfileData({ ...profileData, trade: e.target.value })
            }
          >
            <option>Select Trade</option>
            <option>General Labor</option>
            <option>Framing</option>
            <option>Electrical</option>
            <option>Plumbing</option>
            <option>HVAC</option>
            <option>Drywall</option>
            <option>Painting</option>
            <option>Roofing</option>
          </select>
          <button type="submit">Complete Profile</button>
        </form>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="success">
        <h1>You are all set!</h1>
        <p>You have been added to the project.</p>
        <a href="/dashboard">Go to Dashboard</a>
      </div>
    );
  }
};
```

### 6.3 Backend Profile Completion

```typescript
// POST /api/auth/complete-profile

export async function completeProfile(req: Request, res: Response) {
  const { token, fullName, phone, company, trade } = req.body;

  // 1. Verify token
  const payload = await verifyMagicLinkToken(token);
  const userId = payload.sub;
  const projectId = payload.projectId;

  // 2. Update user profile
  await db
    .update('user_profiles')
    .set({
      fullName,
      phone,
      company,
      trade,
    })
    .where({ id: userId });

  // 3. Update project_members status to 'accepted'
  await db
    .update('project_members')
    .set({
      acceptedAt: new Date(),
      status: 'accepted',
    })
    .where({
      userId,
      projectId,
    });

  // 4. Create session
  const accessToken = generateAccessToken({
    sub: userId,
    role: await getProjectRole(userId, projectId),
    projectIds: await getUserProjects(userId),
  });

  const refreshToken = generateRefreshToken({
    sub: userId,
  });

  // 5. Set refresh token cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // 6. Audit log
  await logAudit({
    userId,
    projectId,
    action: 'accept_invite',
    resourceType: 'project_member',
    resourceId: userId,
    newValue: { status: 'accepted' },
  });

  res.json({
    success: true,
    accessToken,
    expiresIn: 3600,
    user: await getUserById(userId),
    roles: await getUserProjectRoles(userId),
  });
}
```

---

## 7. Security Requirements

### 7.1 API Authentication

**All API endpoints** (except `/auth/signup`, `/auth/magic-link`, `/auth/google`) must verify:
1. JWT in `Authorization: Bearer {token}` header
2. Token signature and expiration
3. User is active (not revoked)
4. Token payload matches current user role (detect privilege escalation)

```typescript
// Middleware: verifyAuth.ts

export const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJWT(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.2 Row-Level Security is the Authoritative Gate

**Client-side role checks are for UX only.** RLS policies in Postgres enforce permissions. Never trust client role state for sensitive operations.

Example:
```typescript
// Frontend: Show/hide UI based on role
if (canAccess(projectId, 'budget', 'write')) {
  <BudgetEditButton />
}

// But the backend RLS policy actually blocks the write:
CREATE POLICY update_budget ON budget_line_items
  FOR UPDATE
  USING (get_user_role_in_project(auth.uid(), project_id) = 'gc_admin');
```

### 7.3 File Access Control

**All file downloads** go through `/api/files/:fileId/download` endpoint, which checks:
1. User is member of project
2. User has read permission for file type
3. User role allows file access (RLS policy)

Files are never directly exposed in storage URLs without signed tokens.

```typescript
// GET /api/files/:fileId/download

export async function downloadFile(req: Request, res: Response) {
  const { fileId } = req.params;
  const userId = req.user.id;

  // 1. Get file metadata
  const file = await db.selectOne('files').where({ id: fileId });
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // 2. Check RLS: can this user read this file?
  const canAccess = await checkRLS(userId, 'files', 'read', {
    projectId: file.projectId,
    isDrawing: file.isDrawing,
  });

  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Generate signed URL for storage
  const signedUrl = await generateSignedStorageUrl(file.storagePath, 3600); // 1 hour

  // 4. Audit log
  await logAudit({
    userId,
    projectId: file.projectId,
    action: 'download_file',
    resourceType: 'file',
    resourceId: fileId,
  });

  res.redirect(signedUrl);
}
```

### 7.4 Audit Logging

Every permission change, file access, and sensitive action is logged:

```sql
INSERT INTO audit_log (user_id, project_id, action, resource_type, resource_id, new_value, ip_address)
VALUES (
  auth.uid(),
  project_id,
  'role_change',
  'user',
  user_id,
  jsonb_build_object('old_role', 'foreman', 'new_role', 'superintendent'),
  inet_client_addr()
);
```

Queries to support compliance:
```sql
-- Who changed user X's role?
SELECT * FROM audit_log
WHERE resource_type = 'user' AND resource_id = 'user-uuid'
ORDER BY created_at DESC;

-- What did user X access on date Y?
SELECT * FROM audit_log
WHERE user_id = 'user-uuid' AND DATE(created_at) = 'YYYY-MM-DD'
ORDER BY created_at;
```

### 7.5 Session Revocation

Admins can revoke a user's access immediately:

```typescript
// POST /api/projects/:projectId/users/:userId/revoke

export async function revokeUserAccess(req: Request, res: Response) {
  const { projectId, userId } = req.params;
  const adminId = req.user.id;

  // 1. Verify admin has permission
  if (!await isGCAdmin(adminId, projectId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Update project_members status
  await db
    .update('project_members')
    .set({ status: 'revoked', updatedAt: new Date() })
    .where({ projectId, userId });

  // 3. Invalidate all sessions
  await db
    .delete('auth_sessions')
    .where({ userId });

  // 4. Audit log
  await logAudit({
    userId: adminId,
    projectId,
    action: 'revoke_access',
    resourceType: 'user',
    resourceId: userId,
  });

  res.json({ success: true });
}
```

---

## 8. Implementation Checklist

**Backend (Supabase/Postgres)**:
- [ ] Create all tables with RLS enabled
- [ ] Implement all RLS policies with exact SQL
- [ ] Create helper functions (get_user_role_in_project, can_user_access_resource)
- [ ] Set up JWT custom claims in Supabase auth
- [ ] Enable email verification in auth settings
- [ ] Configure OAuth providers (Google)
- [ ] Set up TOTP for MFA
- [ ] Create audit_log table and triggers
- [ ] Implement session management table
- [ ] Test RLS policies thoroughly with different roles

**Frontend (React)**:
- [ ] Create TypeScript auth types and interfaces
- [ ] Build Zustand auth store with all actions
- [ ] Implement ProtectedRoute wrapper
- [ ] Build Login page with all auth methods
- [ ] Build AcceptInvite page with profile completion
- [ ] Implement API client with token refresh interceptor
- [ ] Build role-based conditional rendering
- [ ] Add MFA setup and verification flows
- [ ] Test all auth flows end-to-end

**API/Backend**:
- [ ] Implement all auth endpoints (/signup, /signin, /magic-link, /google, /mfa/*, /refresh, /logout)
- [ ] Implement invite endpoint and onboarding
- [ ] Add auth middleware for token verification
- [ ] Implement file download protection
- [ ] Add audit logging to all sensitive operations
- [ ] Implement session revocation

---

## Notes for AI Engine

1. **RLS is the security boundary.** Client-side role checks are cosmetic.
2. **Every table needs RLS enabled.** No exceptions.
3. **JWT custom claims** must include `role` and `project_ids` array.
4. **Refresh tokens** are stored in secure HTTP-only cookies. Access tokens in memory.
5. **Magic links** are 15-minute one-time tokens.
6. **File access** goes through `/api/files/:id/download` with RLS checks, never direct URLs.
7. **Audit everything.** Permission changes, file access, invites.
8. **Test RLS thoroughly.** Write tests for each role and resource combination.
9. **Construction-specific language.** Speak like a superintendent, not a software PM. Field crews hate passwords (prefer magic links).
10. **The permission matrix (Section 3) is the source of truth.** Code it exactly.
