# SiteSync AI - Complete API Specification

## Overview
SiteSync AI uses Supabase for data persistence with a PostgreSQL backend. Most CRUD operations flow through the Supabase JavaScript client. Complex operations and AI features are handled by edge functions.

This specification is the authoritative source for all API interactions. Every code generation task must reference these patterns.

---

## 1. Supabase Client Query Patterns

### 1.1 RFIs (Request for Information)

#### Types
```typescript
// Core RFI type
export interface RFI {
  id: string;
  project_id: string;
  number: string; // RFI-001, RFI-002, etc.
  title: string;
  description: string;
  status: 'open' | 'under_review' | 'answered' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  created_by: string; // user_id
  created_at: string; // ISO 8601
  updated_at: string;
  due_date: string | null;
  closed_date: string | null;
  assigned_to: string | null; // user_id
  answer: string | null;
  answered_by: string | null; // user_id
  answered_at: string | null;
  attachments: string[]; // file_storage_paths
  tags: string[];
}

export interface RFIFilters {
  status?: RFI['status'][];
  priority?: RFI['priority'][];
  created_by?: string;
  assigned_to?: string;
  overdue?: boolean;
  search?: string; // full-text search
}

export interface CreateRFIInput {
  title: string;
  description: string;
  priority: RFI['priority'];
  due_date?: string;
  assigned_to?: string;
  tags?: string[];
}

export interface UpdateRFIInput {
  title?: string;
  description?: string;
  status?: RFI['status'];
  priority?: RFI['priority'];
  due_date?: string;
  assigned_to?: string;
  answer?: string;
  tags?: string[];
}
```

#### List Query with Filters and Pagination
```typescript
async function listRFIs(
  projectId: string,
  filters?: RFIFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: RFI[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('rfis')
    .select(
      `
      id, project_id, number, title, description, status, priority,
      created_by, created_at, updated_at, due_date, closed_date,
      assigned_to, answer, answered_by, answered_at, attachments, tags
      `,
      { count: 'exact' }
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Apply priority filter
  if (filters?.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority);
  }

  // Apply assigned_to filter
  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  // Apply created_by filter
  if (filters?.created_by) {
    query = query.eq('created_by', filters.created_by);
  }

  // Apply overdue filter (due_date < now AND status != 'closed')
  if (filters?.overdue) {
    query = query
      .lt('due_date', new Date().toISOString())
      .neq('status', 'closed');
  }

  // Apply full-text search (requires tsvector column on rfis)
  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  // Pagination using offset (alternative: cursor-based in section 7)
  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list RFIs: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}
```

#### Detail Query with Related Data
```typescript
async function getRFIDetail(
  projectId: string,
  rfiId: string
): Promise<RFI & {
  created_by_user: { id: string; name: string; email: string };
  assigned_to_user: { id: string; name: string; email: string } | null;
  answered_by_user: { id: string; name: string; email: string } | null;
  comments: Array<{
    id: string;
    text: string;
    created_by: string;
    created_at: string;
    author: { name: string; avatar_url: string };
  }>;
}> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('rfis')
    .select(
      `
      id, project_id, number, title, description, status, priority,
      created_by, created_at, updated_at, due_date, closed_date,
      assigned_to, answer, answered_by, answered_at, attachments, tags,
      created_by_user:users!created_by(id, name, email),
      assigned_to_user:users!assigned_to(id, name, email),
      answered_by_user:users!answered_by(id, name, email),
      comments(id, text, created_by, created_at, author:users!created_by(name, avatar_url))
      `
    )
    .eq('project_id', projectId)
    .eq('id', rfiId)
    .single();

  if (error) throw new Error(`Failed to get RFI: ${error.message}`);
  if (!data) throw new Error('RFI not found');

  return data;
}
```

#### Create Mutation
```typescript
async function createRFI(
  projectId: string,
  input: CreateRFIInput
): Promise<RFI> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  // Generate next RFI number by querying max number
  const { data: lastRFI } = await supabase
    .from('rfis')
    .select('number')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const nextNumber = lastRFI
    ? `RFI-${String(parseInt(lastRFI.number.split('-')[1]) + 1).padStart(3, '0')}`
    : 'RFI-001';

  const { data, error } = await supabase
    .from('rfis')
    .insert({
      project_id: projectId,
      number: nextNumber,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'open',
      due_date: input.due_date || null,
      assigned_to: input.assigned_to || null,
      created_by: user.id,
      tags: input.tags || [],
      attachments: []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create RFI: ${error.message}`);
  return data;
}
```

#### Update Mutation
```typescript
async function updateRFI(
  projectId: string,
  rfiId: string,
  input: UpdateRFIInput
): Promise<RFI> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updates: any = {
    ...input,
    updated_at: new Date().toISOString()
  };

  // If marking as answered, set answered_by and answered_at
  if (input.status === 'answered' && input.answer) {
    updates.answered_by = user?.id;
    updates.answered_at = new Date().toISOString();
  }

  // If closing, set closed_date
  if (input.status === 'closed') {
    updates.closed_date = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('rfis')
    .update(updates)
    .eq('project_id', projectId)
    .eq('id', rfiId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update RFI: ${error.message}`);
  return data;
}
```

#### Soft Delete (set deleted_at timestamp)
```typescript
async function softDeleteRFI(
  projectId: string,
  rfiId: string
): Promise<void> {
  const { supabase } = useSupabaseClient();

  const { error } = await supabase
    .from('rfis')
    .update({ deleted_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('id', rfiId);

  if (error) throw new Error(`Failed to delete RFI: ${error.message}`);
}
```

#### Real-time Subscription
```typescript
function subscribeToRFIs(
  projectId: string,
  onUpdate: (update: RealtimeMessage) => void,
  onError: (error: any) => void
): () => void {
  const { supabase } = useSupabaseClient();

  const subscription = supabase
    .channel(`rfis:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rfis',
        filter: `project_id=eq.${projectId}`
      },
      onUpdate
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to RFI updates');
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(subscription);
  };
}
```

---

### 1.2 Submittals

#### Types
```typescript
export interface Submittal {
  id: string;
  project_id: string;
  number: string; // SUB-001, SUB-002, etc.
  title: string;
  description: string;
  specification_section: string; // CSI section, e.g., "03 30 00 Cast in Place Concrete"
  status: 'draft' | 'submitted' | 'review_in_progress' | 'approved' | 'rejected' | 'approved_as_noted';
  submission_date: string | null;
  due_date: string;
  approval_date: string | null;
  created_by: string; // user_id
  created_at: string;
  updated_at: string;
  submitted_by: string | null; // user_id
  approved_by: string | null; // user_id
  review_comments: string | null;
  attachments: string[]; // file_storage_paths (PDFs, images, etc.)
  tags: string[];
}

export interface SubmittalFilters {
  status?: Submittal['status'][];
  specification_section?: string;
  submitted_by?: string;
  approved_by?: string;
  overdue?: boolean;
  search?: string;
}

export interface CreateSubmittalInput {
  title: string;
  description: string;
  specification_section: string;
  due_date: string;
  tags?: string[];
}

export interface UpdateSubmittalInput {
  title?: string;
  description?: string;
  status?: Submittal['status'];
  review_comments?: string;
  approved_by?: string;
  tags?: string[];
}
```

#### List Query
```typescript
async function listSubmittals(
  projectId: string,
  filters?: SubmittalFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: Submittal[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('submittals')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.specification_section) {
    query = query.eq('specification_section', filters.specification_section);
  }

  if (filters?.submitted_by) {
    query = query.eq('submitted_by', filters.submitted_by);
  }

  if (filters?.approved_by) {
    query = query.eq('approved_by', filters.approved_by);
  }

  if (filters?.overdue) {
    query = query
      .lt('due_date', new Date().toISOString())
      .neq('status', 'approved')
      .neq('status', 'approved_as_noted');
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,specification_section.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list submittals: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}
```

#### Create Mutation
```typescript
async function createSubmittal(
  projectId: string,
  input: CreateSubmittalInput
): Promise<Submittal> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data: lastSubmittal } = await supabase
    .from('submittals')
    .select('number')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const nextNumber = lastSubmittal
    ? `SUB-${String(parseInt(lastSubmittal.number.split('-')[1]) + 1).padStart(3, '0')}`
    : 'SUB-001';

  const { data, error } = await supabase
    .from('submittals')
    .insert({
      project_id: projectId,
      number: nextNumber,
      title: input.title,
      description: input.description,
      specification_section: input.specification_section,
      due_date: input.due_date,
      status: 'draft',
      created_by: user.id,
      tags: input.tags || [],
      attachments: []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create submittal: ${error.message}`);
  return data;
}
```

---

### 1.3 Change Orders

#### Types
```typescript
export interface ChangeOrder {
  id: string;
  project_id: string;
  number: string; // CO-001, CO-002, etc.
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'implemented';
  reason: 'owner_request' | 'field_condition' | 'design_error' | 'value_engineering' | 'contract_clarification' | 'other';
  cost_impact: number; // in cents to avoid floating point issues
  schedule_impact_days: number; // positive = delay, negative = acceleration
  created_by: string; // user_id
  created_at: string;
  updated_at: string;
  submitted_date: string | null;
  approved_date: string | null;
  approved_by: string | null; // user_id
  implementation_date: string | null;
  attachments: string[];
  tags: string[];
}

export interface ChangeOrderFilters {
  status?: ChangeOrder['status'][];
  reason?: ChangeOrder['reason'][];
  created_by?: string;
  approved_by?: string;
  cost_impact_min?: number;
  cost_impact_max?: number;
  search?: string;
}

export interface CreateChangeOrderInput {
  title: string;
  description: string;
  reason: ChangeOrder['reason'];
  cost_impact: number;
  schedule_impact_days?: number;
  tags?: string[];
}

export interface UpdateChangeOrderInput {
  title?: string;
  description?: string;
  status?: ChangeOrder['status'];
  cost_impact?: number;
  schedule_impact_days?: number;
  reason?: ChangeOrder['reason'];
  tags?: string[];
}
```

#### List and CRUD Operations
```typescript
async function listChangeOrders(
  projectId: string,
  filters?: ChangeOrderFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: ChangeOrder[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('change_orders')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.reason && filters.reason.length > 0) {
    query = query.in('reason', filters.reason);
  }

  if (filters?.created_by) {
    query = query.eq('created_by', filters.created_by);
  }

  if (filters?.cost_impact_min !== undefined) {
    query = query.gte('cost_impact', filters.cost_impact_min);
  }

  if (filters?.cost_impact_max !== undefined) {
    query = query.lte('cost_impact', filters.cost_impact_max);
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list change orders: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}

async function createChangeOrder(
  projectId: string,
  input: CreateChangeOrderInput
): Promise<ChangeOrder> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data: lastCO } = await supabase
    .from('change_orders')
    .select('number')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const nextNumber = lastCO
    ? `CO-${String(parseInt(lastCO.number.split('-')[1]) + 1).padStart(3, '0')}`
    : 'CO-001';

  const { data, error } = await supabase
    .from('change_orders')
    .insert({
      project_id: projectId,
      number: nextNumber,
      title: input.title,
      description: input.description,
      reason: input.reason,
      cost_impact: Math.round(input.cost_impact * 100),
      schedule_impact_days: input.schedule_impact_days || 0,
      status: 'draft',
      created_by: user.id,
      tags: input.tags || [],
      attachments: []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create change order: ${error.message}`);
  return data;
}
```

---

### 1.4 Daily Logs

#### Types
```typescript
export interface DailyLog {
  id: string;
  project_id: string;
  date: string; // ISO date YYYY-MM-DD
  weather: string; // Brief description: "Sunny", "Rain", "Partial cloud", etc.
  temperature_high: number; // Fahrenheit
  temperature_low: number;
  crew_count: number;
  work_summary: string; // What was accomplished
  issues_delays: string | null; // Issues encountered
  visitors: string[]; // Names of visitors/inspectors
  safety_incidents: number; // Count of incidents
  photos: string[]; // file_storage_paths
  created_by: string; // user_id (superintendent)
  created_at: string;
  updated_at: string;
  tags: string[]; // e.g., "concrete_pour", "framing", etc.
}

export interface DailyLogFilters {
  date_from?: string;
  date_to?: string;
  created_by?: string;
  tag?: string;
  search?: string;
}

export interface CreateDailyLogInput {
  date: string;
  weather: string;
  temperature_high: number;
  temperature_low: number;
  crew_count: number;
  work_summary: string;
  issues_delays?: string;
  visitors?: string[];
  safety_incidents?: number;
  tags?: string[];
}

export interface UpdateDailyLogInput {
  weather?: string;
  temperature_high?: number;
  temperature_low?: number;
  crew_count?: number;
  work_summary?: string;
  issues_delays?: string;
  visitors?: string[];
  safety_incidents?: number;
  tags?: string[];
}
```

#### List and CRUD
```typescript
async function listDailyLogs(
  projectId: string,
  filters?: DailyLogFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: DailyLog[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('daily_logs')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('date', { ascending: false });

  if (filters?.date_from) {
    query = query.gte('date', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('date', filters.date_to);
  }

  if (filters?.created_by) {
    query = query.eq('created_by', filters.created_by);
  }

  if (filters?.tag) {
    query = query.contains('tags', [filters.tag]);
  }

  if (filters?.search) {
    query = query.or(
      `work_summary.ilike.%${filters.search}%,issues_delays.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list daily logs: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}

async function createDailyLog(
  projectId: string,
  input: CreateDailyLogInput
): Promise<DailyLog> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('daily_logs')
    .insert({
      project_id: projectId,
      date: input.date,
      weather: input.weather,
      temperature_high: input.temperature_high,
      temperature_low: input.temperature_low,
      crew_count: input.crew_count,
      work_summary: input.work_summary,
      issues_delays: input.issues_delays || null,
      visitors: input.visitors || [],
      safety_incidents: input.safety_incidents || 0,
      photos: [],
      created_by: user.id,
      tags: input.tags || []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create daily log: ${error.message}`);
  return data;
}
```

---

### 1.5 Punch List Items

#### Types
```typescript
export interface PunchListItem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  location: string; // e.g., "3rd Floor, Room 302"
  trade: string; // e.g., "Electrical", "Drywall", "Paint"
  status: 'open' | 'in_progress' | 'completed' | 'hold' | 'approved';
  priority: 'low' | 'normal' | 'high' | 'critical';
  assigned_to: string | null; // user_id
  created_by: string; // user_id
  created_at: string;
  updated_at: string;
  due_date: string | null;
  completed_date: string | null;
  approved_date: string | null;
  approved_by: string | null; // user_id
  before_photo: string | null; // file_storage_path
  after_photo: string | null;
  completion_notes: string | null;
  tags: string[];
}

export interface PunchListFilters {
  status?: PunchListItem['status'][];
  priority?: PunchListItem['priority'][];
  trade?: string;
  assigned_to?: string;
  overdue?: boolean;
  search?: string;
}

export interface CreatePunchListInput {
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchListItem['priority'];
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
}

export interface UpdatePunchListInput {
  title?: string;
  description?: string;
  status?: PunchListItem['status'];
  priority?: PunchListItem['priority'];
  assigned_to?: string;
  due_date?: string;
  completion_notes?: string;
  tags?: string[];
}
```

#### List and CRUD
```typescript
async function listPunchItems(
  projectId: string,
  filters?: PunchListFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: PunchListItem[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('punch_list_items')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority);
  }

  if (filters?.trade) {
    query = query.eq('trade', filters.trade);
  }

  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  if (filters?.overdue) {
    query = query
      .lt('due_date', new Date().toISOString())
      .neq('status', 'completed')
      .neq('status', 'approved');
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list punch items: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}

async function createPunchItem(
  projectId: string,
  input: CreatePunchListInput
): Promise<PunchListItem> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('punch_list_items')
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description,
      location: input.location,
      trade: input.trade,
      priority: input.priority,
      assigned_to: input.assigned_to || null,
      due_date: input.due_date || null,
      status: 'open',
      created_by: user.id,
      tags: input.tags || []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create punch item: ${error.message}`);
  return data;
}
```

---

### 1.6 Drawings

#### Types
```typescript
export interface Drawing {
  id: string;
  project_id: string;
  set_number: string; // Set-001, Set-002, etc.
  name: string; // e.g., "Architectural Floor Plan A1.0"
  discipline: 'architectural' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'civil' | 'other';
  file_path: string; // Supabase storage path (PDF, DWG viewer URL)
  file_size_bytes: number;
  revision: string; // e.g., "A1", "A2", "B", "C1"
  revision_date: string; // ISO date when this revision was issued
  issued_date: string; // ISO date
  created_at: string;
  updated_at: string;
  created_by: string; // user_id
  markup_count: number; // Count of open markups
  status: 'current' | 'superseded' | 'draft' | 'archived';
  tags: string[];
}

export interface DrawingMarkup {
  id: string;
  drawing_id: string;
  type: 'comment' | 'highlight' | 'redline' | 'bubble';
  text: string;
  location: { x: number; y: number; page: number }; // For multi-page PDFs
  created_by: string; // user_id
  created_at: string;
  resolved: boolean;
}

export interface DrawingFilters {
  discipline?: Drawing['discipline'][];
  status?: Drawing['status'][];
  created_by?: string;
  search?: string;
}

export interface CreateDrawingInput {
  set_number: string;
  name: string;
  discipline: Drawing['discipline'];
  revision: string;
  revision_date: string;
  file: File; // Will be uploaded to Supabase Storage
  tags?: string[];
}
```

#### List and Detail
```typescript
async function listDrawings(
  projectId: string,
  filters?: DrawingFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: Drawing[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('drawings')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('revision_date', { ascending: false });

  if (filters?.discipline && filters.discipline.length > 0) {
    query = query.in('discipline', filters.discipline);
  }

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.created_by) {
    query = query.eq('created_by', filters.created_by);
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,discipline.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list drawings: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}

async function getDrawingDetail(projectId: string, drawingId: string): Promise<Drawing & { markups: DrawingMarkup[] }> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('drawings')
    .select('*, markups(*)')
    .eq('project_id', projectId)
    .eq('id', drawingId)
    .single();

  if (error) throw new Error(`Failed to get drawing: ${error.message}`);
  if (!data) throw new Error('Drawing not found');

  return data;
}
```

---

### 1.7 Schedule Activities

#### Types
```typescript
export interface ScheduleActivity {
  id: string;
  project_id: string;
  activity_id: string; // e.g., "A101", "A102" for Gantt/P6 compatibility
  activity_name: string; // e.g., "Excavation", "Foundation", "Framing"
  discipline: string; // e.g., "Sitework", "Structural", "MEP"
  start_date: string; // ISO date
  finish_date: string; // ISO date
  planned_duration_days: number;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  percent_complete: number; // 0-100
  status: 'not_started' | 'in_progress' | 'completed' | 'hold' | 'at_risk';
  critical_path: boolean; // Is this on the critical path?
  predecessor_ids: string[]; // Array of activity IDs
  successor_ids: string[];
  responsible_party: string | null; // user_id or contractor name
  float_days: number; // Total float / slack
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface ScheduleFilters {
  status?: ScheduleActivity['status'][];
  discipline?: string;
  responsible_party?: string;
  critical_path_only?: boolean;
  at_risk?: boolean;
  search?: string;
}

export interface UpdateScheduleActivityInput {
  percent_complete?: number;
  actual_start_date?: string | null;
  actual_finish_date?: string | null;
  status?: ScheduleActivity['status'];
  float_days?: number;
  notes?: string;
}
```

#### List and CRUD
```typescript
async function listScheduleActivities(
  projectId: string,
  filters?: ScheduleFilters,
  page: number = 1,
  pageSize: number = 100
): Promise<{ data: ScheduleActivity[]; total: number; hasMore: boolean }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('schedule_activities')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.discipline) {
    query = query.eq('discipline', filters.discipline);
  }

  if (filters?.responsible_party) {
    query = query.eq('responsible_party', filters.responsible_party);
  }

  if (filters?.critical_path_only) {
    query = query.eq('critical_path', true);
  }

  if (filters?.at_risk) {
    query = query.eq('status', 'at_risk');
  }

  if (filters?.search) {
    query = query.or(
      `activity_name.ilike.%${filters.search}%,discipline.ilike.%${filters.search}%`
    );
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list schedule activities: ${error.message}`);

  return {
    data: data || [],
    total: count || 0,
    hasMore: offset + pageSize < (count || 0)
  };
}

async function updateScheduleActivity(
  projectId: string,
  activityId: string,
  input: UpdateScheduleActivityInput
): Promise<ScheduleActivity> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('schedule_activities')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
      // Auto-detect status based on percent_complete
      status: input.percent_complete === 100 ? 'completed' :
              input.percent_complete === 0 ? 'not_started' : 'in_progress'
    })
    .eq('project_id', projectId)
    .eq('id', activityId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update activity: ${error.message}`);
  return data;
}
```

---

### 1.8 Budget Line Items

#### Types
```typescript
export interface BudgetLineItem {
  id: string;
  project_id: string;
  csi_code: string; // CSI MasterFormat, e.g., "03 30 00"
  csi_description: string; // e.g., "Cast in Place Concrete"
  account_code: string; // Internal accounting code
  original_budget_cents: number; // In cents to avoid float issues
  revised_budget_cents: number;
  spent_to_date_cents: number;
  committed_cents: number; // POs issued but not paid
  forecasted_final_cost_cents: number;
  status: 'draft' | 'approved' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
  responsible_party: string | null; // user_id or vendor name
  notes: string | null;
}

export interface BudgetFilters {
  status?: BudgetLineItem['status'][];
  responsible_party?: string;
  search?: string; // Search in CSI description or account code
  over_budget?: boolean; // forecasted_final > revised_budget
}

export interface UpdateBudgetLineItemInput {
  revised_budget_cents?: number;
  spent_to_date_cents?: number;
  committed_cents?: number;
  forecasted_final_cost_cents?: number;
  notes?: string;
}
```

#### List and CRUD
```typescript
async function listBudgetLineItems(
  projectId: string,
  filters?: BudgetFilters
): Promise<BudgetLineItem[]> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('budget_line_items')
    .select('*')
    .eq('project_id', projectId)
    .order('csi_code', { ascending: true });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.responsible_party) {
    query = query.eq('responsible_party', filters.responsible_party);
  }

  if (filters?.over_budget) {
    // Note: This requires raw SQL or client-side filtering
    query = query.select('*');
  }

  if (filters?.search) {
    query = query.or(
      `csi_description.ilike.%${filters.search}%,account_code.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to list budget items: ${error.message}`);

  // Client-side filter for over_budget
  let result = data || [];
  if (filters?.over_budget) {
    result = result.filter(item => item.forecasted_final_cost_cents > item.revised_budget_cents);
  }

  return result;
}

async function updateBudgetLineItem(
  projectId: string,
  itemId: string,
  input: UpdateBudgetLineItemInput
): Promise<BudgetLineItem> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('budget_line_items')
    .update({
      ...input,
      updated_at: new Date().toISOString()
    })
    .eq('project_id', projectId)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update budget item: ${error.message}`);
  return data;
}

// Compute budget metrics (called from dashboard)
async function getBudgetSummary(projectId: string): Promise<{
  total_budget_cents: number;
  total_spent_cents: number;
  total_committed_cents: number;
  total_forecasted_cents: number;
  variance_cents: number;
  variance_percent: number;
  over_budget_count: number;
}> {
  const items = await listBudgetLineItems(projectId);

  const total_budget = items.reduce((sum, item) => sum + item.revised_budget_cents, 0);
  const total_spent = items.reduce((sum, item) => sum + item.spent_to_date_cents, 0);
  const total_committed = items.reduce((sum, item) => sum + item.committed_cents, 0);
  const total_forecasted = items.reduce((sum, item) => sum + item.forecasted_final_cost_cents, 0);
  const variance = total_budget - total_forecasted;
  const over_budget_count = items.filter(item => item.forecasted_final_cost_cents > item.revised_budget_cents).length;

  return {
    total_budget_cents: total_budget,
    total_spent_cents: total_spent,
    total_committed_cents: total_committed,
    total_forecasted_cents: total_forecasted,
    variance_cents: variance,
    variance_percent: total_budget > 0 ? (variance / total_budget) * 100 : 0,
    over_budget_count
  };
}
```

---

### 1.9 Pay Applications (AIA G702/G703)

#### Types
```typescript
export interface PayApplication {
  id: string;
  project_id: string;
  app_number: number; // App #1, App #2, etc.
  period_start_date: string; // ISO date
  period_end_date: string; // ISO date
  application_date: string;
  payment_due_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  total_work_completed_cents: number;
  total_materials_stored_cents: number;
  total_contract_sum_to_date_cents: number;
  retainage_percent: number; // e.g., 10
  retainage_amount_cents: number;
  previous_application_balance_cents: number;
  amount_due_this_period_cents: number;
  amount_paid_to_date_cents: number;
  balance_due_cents: number;
  submitted_by: string | null; // user_id (contractor)
  submitted_date: string | null;
  approved_by: string | null; // user_id (owner/architect)
  approved_date: string | null;
  paid_date: string | null;
  notes: string | null;
  attachments: string[]; // file_storage_paths (backup docs, invoices)
  created_at: string;
  updated_at: string;
}

export interface PayAppLineItem {
  id: string;
  pay_application_id: string;
  budget_line_item_id: string; // References budget_line_items
  csi_code: string;
  description: string;
  contract_sum_cents: number;
  percent_complete: number;
  work_completed_this_period_cents: number; // Cumulative
  materials_stored_this_period_cents: number;
}

export interface CreatePayApplicationInput {
  period_start_date: string;
  period_end_date: string;
  retainage_percent?: number;
  notes?: string;
}
```

#### List and CRUD
```typescript
async function listPayApplications(
  projectId: string,
  status?: PayApplication['status'][],
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: PayApplication[]; total: number }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('pay_applications')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('app_number', { ascending: false });

  if (status && status.length > 0) {
    query = query.in('status', status);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list pay applications: ${error.message}`);

  return {
    data: data || [],
    total: count || 0
  };
}

async function createPayApplication(
  projectId: string,
  input: CreatePayApplicationInput
): Promise<PayApplication> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  // Get the next app number
  const { data: lastApp } = await supabase
    .from('pay_applications')
    .select('app_number')
    .eq('project_id', projectId)
    .order('app_number', { ascending: false })
    .limit(1)
    .single();

  const nextAppNumber = (lastApp?.app_number || 0) + 1;

  const { data, error } = await supabase
    .from('pay_applications')
    .insert({
      project_id: projectId,
      app_number: nextAppNumber,
      period_start_date: input.period_start_date,
      period_end_date: input.period_end_date,
      application_date: new Date().toISOString(),
      retainage_percent: input.retainage_percent || 10,
      status: 'draft',
      notes: input.notes || null,
      attachments: []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create pay application: ${error.message}`);
  return data;
}
```

---

### 1.10 Crews

#### Types
```typescript
export interface Crew {
  id: string;
  project_id: string;
  name: string; // e.g., "Concrete Crew A", "Electrical Sub Team"
  trade: string; // e.g., "Concrete", "Electrical", "Carpentry"
  foreman_id: string; // user_id
  members: string[]; // Array of user_ids
  status: 'active' | 'inactive' | 'archived';
  start_date: string; // ISO date
  expected_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  crew_id: string;
  user_id: string;
  date: string; // ISO date
  hours_worked: number;
  status: 'present' | 'absent' | 'half_day' | 'other';
  notes: string | null;
}

export interface CrewFilters {
  status?: Crew['status'][];
  trade?: string;
  foreman_id?: string;
  search?: string;
}

export interface CreateCrewInput {
  name: string;
  trade: string;
  foreman_id: string;
  members?: string[];
  expected_end_date?: string;
}
```

#### List and CRUD
```typescript
async function listCrews(
  projectId: string,
  filters?: CrewFilters
): Promise<Crew[]> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('crews')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.trade) {
    query = query.eq('trade', filters.trade);
  }

  if (filters?.foreman_id) {
    query = query.eq('foreman_id', filters.foreman_id);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to list crews: ${error.message}`);
  return data || [];
}

async function createCrew(
  projectId: string,
  input: CreateCrewInput
): Promise<Crew> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('crews')
    .insert({
      project_id: projectId,
      name: input.name,
      trade: input.trade,
      foreman_id: input.foreman_id,
      members: input.members || [],
      status: 'active',
      start_date: new Date().toISOString(),
      expected_end_date: input.expected_end_date || null
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create crew: ${error.message}`);
  return data;
}

// Log crew attendance
async function logAttendance(
  crewId: string,
  userId: string,
  date: string,
  hoursWorked: number,
  status: Attendance['status'] = 'present'
): Promise<Attendance> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      crew_id: crewId,
      user_id: userId,
      date,
      hours_worked: hoursWorked,
      status
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log attendance: ${error.message}`);
  return data;
}
```

---

### 1.11 Meetings

#### Types
```typescript
export interface Meeting {
  id: string;
  project_id: string;
  title: string;
  description: string;
  meeting_date: string; // ISO datetime
  location: string | null;
  duration_minutes: number;
  meeting_type: 'field' | 'coordination' | 'safety' | 'owner' | 'progress' | 'other';
  organizer_id: string; // user_id
  attendees: string[]; // Array of user_ids
  created_at: string;
  updated_at: string;
  minutes: string | null; // Meeting notes/minutes
  action_items: MeetingActionItem[];
  attachments: string[];
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to: string; // user_id
  due_date: string;
  status: 'open' | 'completed';
  completed_date: string | null;
}

export interface CreateMeetingInput {
  title: string;
  description: string;
  meeting_date: string;
  location?: string;
  duration_minutes: number;
  meeting_type: Meeting['meeting_type'];
  attendees?: string[];
}
```

#### List and CRUD
```typescript
async function listMeetings(
  projectId: string,
  date_from?: string,
  date_to?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: Meeting[]; total: number }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('meetings')
    .select('*, action_items(*)', { count: 'exact' })
    .eq('project_id', projectId)
    .order('meeting_date', { ascending: false });

  if (date_from) {
    query = query.gte('meeting_date', date_from);
  }

  if (date_to) {
    query = query.lte('meeting_date', date_to);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list meetings: ${error.message}`);

  return {
    data: data || [],
    total: count || 0
  };
}

async function createMeeting(
  projectId: string,
  input: CreateMeetingInput
): Promise<Meeting> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description,
      meeting_date: input.meeting_date,
      location: input.location || null,
      duration_minutes: input.duration_minutes,
      meeting_type: input.meeting_type,
      organizer_id: user.id,
      attendees: input.attendees || [user.id],
      attachments: []
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create meeting: ${error.message}`);
  return data;
}
```

---

### 1.12 Files

#### Types
```typescript
export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  file_type: string; // MIME type, e.g., "application/pdf"
  file_size_bytes: number;
  storage_path: string; // Supabase storage path
  category: 'contract' | 'drawing' | 'photo' | 'report' | 'correspondence' | 'other';
  uploaded_by: string; // user_id
  uploaded_at: string;
  updated_at: string;
  related_entity_type: string | null; // e.g., "rfi", "submittal", "daily_log"
  related_entity_id: string | null;
  tags: string[];
  version: number; // For versioned docs
}

export interface FileFilters {
  category?: ProjectFile['category'][];
  uploaded_by?: string;
  related_entity_type?: string;
  search?: string;
}
```

#### List, Upload, and Access
```typescript
async function listFiles(
  projectId: string,
  filters?: FileFilters,
  page: number = 1,
  pageSize: number = 100
): Promise<{ data: ProjectFile[]; total: number }> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('project_files')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (filters?.category && filters.category.length > 0) {
    query = query.in('category', filters.category);
  }

  if (filters?.uploaded_by) {
    query = query.eq('uploaded_by', filters.uploaded_by);
  }

  if (filters?.related_entity_type) {
    query = query.eq('related_entity_type', filters.related_entity_type);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw new Error(`Failed to list files: ${error.message}`);

  return {
    data: data || [],
    total: count || 0
  };
}

// Generate signed download URL (valid for 1 hour)
async function getSignedFileUrl(
  storagePath: string
): Promise<string> {
  const { supabase } = useSupabaseClient();

  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(storagePath, 3600); // 1 hour

  if (error) throw new Error(`Failed to generate signed URL: ${error.message}`);
  return data.signedUrl;
}
```

---

## 2. Edge Function Endpoints

All edge functions are hosted at `https://{PROJECT_ID}.supabase.co/functions/v1/{function_name}`.

Authentication: All requests must include `Authorization: Bearer {access_token}` header using the Supabase session token.

### 2.1 AI Copilot

**URL:** `/functions/v1/ai-copilot`
**Method:** POST

```typescript
export interface CopilotRequest {
  project_id: string;
  message: string;
  context?: {
    entity_type?: string; // "rfi", "submittal", "schedule", etc.
    entity_id?: string;
  };
}

export interface CopilotResponse {
  reply: string; // AI response
  suggestions?: Array<{
    text: string;
    action?: string; // "create_rfi", "update_schedule", etc.
    payload?: any;
  }>;
  thinking?: string; // For debugging/transparency
}
```

**Example:**
```typescript
async function askCopilot(
  projectId: string,
  message: string
): Promise<CopilotResponse> {
  const { supabase } = useSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke('ai-copilot', {
    body: {
      project_id: projectId,
      message
    },
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  if (error) throw new Error(`Copilot error: ${error.message}`);
  return data;
}
```

---

### 2.2 AI RFI Draft

Generate a professional RFI based on field notes.

**URL:** `/functions/v1/ai-rfi-draft`
**Method:** POST

```typescript
export interface DraftRFIRequest {
  project_id: string;
  field_notes: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface DraftRFIResponse {
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  suggested_due_days: number;
}
```

---

### 2.3 AI Daily Summary

Generate a concise daily log summary from field notes and photos.

**URL:** `/functions/v1/ai-daily-summary`
**Method:** POST

```typescript
export interface DailySummaryRequest {
  project_id: string;
  date: string;
  field_notes: string;
  photo_urls?: string[]; // Signed URLs to Supabase storage
  temperature_high?: number;
  temperature_low?: number;
  crew_count?: number;
}

export interface DailySummaryResponse {
  work_summary: string;
  suggested_tags: string[];
  issues_detected?: string[]; // AI-detected safety/progress issues
  photo_captions: { [photoUrl: string]: string };
}
```

---

### 2.4 AI Schedule Risk Analysis

Analyze schedule for delays, critical path changes, and risk.

**URL:** `/functions/v1/ai-schedule-risk`
**Method:** POST

```typescript
export interface ScheduleRiskRequest {
  project_id: string;
}

export interface ScheduleRiskResponse {
  overall_health: 'green' | 'yellow' | 'red';
  critical_path_risk: Array<{
    activity_id: string;
    activity_name: string;
    risk_level: 'low' | 'medium' | 'high';
    risk_description: string;
  }>;
  delay_probability: number; // 0-100, probability of project delay
  estimated_delay_days: number | null;
  recommendations: string[];
}
```

---

### 2.5 AI Conflict Detection

Detect coordination conflicts in drawings/specs.

**URL:** `/functions/v1/ai-conflict-detection`
**Method:** POST

```typescript
export interface ConflictDetectionRequest {
  project_id: string;
  drawing_ids?: string[];
  scan_submittals?: boolean;
}

export interface ConflictDetectionResponse {
  conflicts: Array<{
    type: 'spatial' | 'structural' | 'mep' | 'schedule' | 'specification';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    drawing_ids?: string[];
    related_entity_ids?: string[];
    suggested_rfi?: DraftRFIResponse;
  }>;
}
```

---

### 2.6 Generate Pay Application (AIA G702/G703)

Generate a formal AIA G702/G703 pay application PDF.

**URL:** `/functions/v1/generate-pay-app`
**Method:** POST

```typescript
export interface GeneratePayAppRequest {
  project_id: string;
  pay_application_id: string;
  include_backup_docs?: boolean;
}

export interface GeneratePayAppResponse {
  pdf_url: string; // Signed URL to download
  file_size_bytes: number;
}
```

---

### 2.7 Generate Report (PDF)

Generate project reports (progress, RFI status, schedule, budget, etc.).

**URL:** `/functions/v1/generate-report`
**Method:** POST

```typescript
export interface GenerateReportRequest {
  project_id: string;
  report_type: 'progress' | 'rfi_status' | 'schedule' | 'budget' | 'custom';
  date_range?: { from: string; to: string };
  include_attachments?: boolean;
}

export interface GenerateReportResponse {
  pdf_url: string;
  file_size_bytes: number;
}
```

---

### 2.8 Weather Sync

Fetch weather data and cache for project location.

**URL:** `/functions/v1/weather-sync`
**Method:** POST

```typescript
export interface WeatherSyncRequest {
  project_id: string;
  latitude: number;
  longitude: number;
  force_refresh?: boolean; // Bypass cache
}

export interface WeatherSyncResponse {
  date: string;
  high_fahrenheit: number;
  low_fahrenheit: number;
  condition: string;
  precipitation_chance: number; // 0-100
  cached: boolean;
}
```

---

### 2.9 Send Notification

Send email, push, and in-app notifications.

**URL:** `/functions/v1/send-notification`
**Method:** POST

```typescript
export interface SendNotificationRequest {
  recipient_ids: string[]; // Array of user_ids
  title: string;
  message: string;
  channels: ('email' | 'push' | 'in_app')[];
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface SendNotificationResponse {
  success: boolean;
  sent_count: number;
  failed_count: number;
}
```

---

### 2.10 Import Procore

Import project data from Procore API (contractor records, change orders, etc.).

**URL:** `/functions/v1/import-procore`
**Method:** POST

```typescript
export interface ImportProcoreRequest {
  project_id: string;
  procore_project_id: string;
  procore_api_token: string; // User provides their own token for security
  import_types: ('change_orders' | 'rfis' | 'submittals' | 'budget' | 'schedule')[];
}

export interface ImportProcoreResponse {
  imported_counts: {
    change_orders?: number;
    rfis?: number;
    submittals?: number;
    budget_items?: number;
    schedule_activities?: number;
  };
  errors?: string[];
}
```

---

### 2.11 Export CSV

Bulk export data to CSV.

**URL:** `/functions/v1/export-csv`
**Method:** POST

```typescript
export interface ExportCsvRequest {
  project_id: string;
  entity_types: ('rfis' | 'submittals' | 'change_orders' | 'daily_logs' | 'punch_list' | 'budget')[];
  filters?: any; // Entity-specific filters
}

export interface ExportCsvResponse {
  csv_url: string; // Signed download URL
  file_size_bytes: number;
}
```

---

## 3. React Hook Patterns

For each entity, define custom hooks that encapsulate Supabase logic and manage state.

### 3.1 useRFIs Hook

```typescript
interface UseRFIsOptions {
  projectId: string;
  filters?: RFIFilters;
  pageSize?: number;
  autoRefetch?: boolean; // Auto-subscribe to real-time updates
}

interface UseRFIsReturn {
  data: RFI[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
  total: number;

  // Mutations
  create: (input: CreateRFIInput) => Promise<RFI>;
  update: (id: string, input: UpdateRFIInput) => Promise<RFI>;
  remove: (id: string) => Promise<void>;

  // Utilities
  refetch: () => Promise<void>;
  getDetail: (id: string) => Promise<RFI & { created_by_user: any; comments: any[] }>;
}

export function useRFIs(options: UseRFIsOptions): UseRFIsReturn {
  const { projectId, filters, pageSize = 50, autoRefetch = true } = options;
  const { supabase } = useSupabaseClient();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);

  // Fetch query using React Query / TanStack Query
  const {
    data: queryData,
    isLoading,
    error,
    refetch
  } = useQuery(
    ['rfis', projectId, filters, page],
    () => listRFIs(projectId, filters, page, pageSize),
    { staleTime: 60000 } // 1 minute
  );

  // Real-time subscription
  useEffect(() => {
    if (!autoRefetch) return;

    const unsubscribe = subscribeToRFIs(
      projectId,
      (update) => {
        // Invalidate cache to trigger refetch
        queryClient.invalidateQueries(['rfis', projectId]);
      },
      (error) => console.error('Subscription error:', error)
    );

    return unsubscribe;
  }, [projectId, autoRefetch, queryClient]);

  // Mutations
  const createMutation = useMutation(
    (input: CreateRFIInput) => createRFI(projectId, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rfis', projectId]);
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, input }: { id: string; input: UpdateRFIInput }) =>
      updateRFI(projectId, id, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rfis', projectId]);
      }
    }
  );

  const removeMutation = useMutation(
    (id: string) => softDeleteRFI(projectId, id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rfis', projectId]);
      }
    }
  );

  return {
    data: queryData?.data || [],
    isLoading,
    error,
    page,
    setPage,
    hasMore: queryData?.hasMore || false,
    total: queryData?.total || 0,

    create: (input) => createMutation.mutateAsync(input),
    update: (id, input) => updateMutation.mutateAsync({ id, input }),
    remove: (id) => removeMutation.mutateAsync(id),

    refetch,
    getDetail: (id) => getRFIDetail(projectId, id)
  };
}
```

### 3.2 useSubmittals Hook

```typescript
export function useSubmittals(
  projectId: string,
  filters?: SubmittalFilters,
  pageSize: number = 50
): UseSubmittalsReturn {
  // Follow the same pattern as useRFIs
  // Implement list, create, update, remove mutations
  // Setup real-time subscriptions
}
```

### 3.3 useChangeOrders Hook

```typescript
export function useChangeOrders(
  projectId: string,
  filters?: ChangeOrderFilters
): UseChangeOrdersReturn {
  // Follow the same pattern
}
```

### 3.4 useDailyLogs Hook

```typescript
export function useDailyLogs(
  projectId: string,
  filters?: DailyLogFilters,
  pageSize: number = 50
): UseDailyLogsReturn {
  // Follow the same pattern
}
```

### 3.5 usePunchList Hook

```typescript
export function usePunchList(
  projectId: string,
  filters?: PunchListFilters,
  pageSize: number = 50
): UsePunchListReturn {
  // Follow the same pattern
}
```

### 3.6 useSchedule Hook

```typescript
export function useSchedule(
  projectId: string,
  filters?: ScheduleFilters,
  pageSize: number = 100
): UseScheduleReturn {
  // Fetch activities, support Gantt chart rendering
  // Mutations for updating activity progress
}
```

### 3.7 useBudget Hook

```typescript
export function useBudget(projectId: string): UseBudgetReturn {
  // Fetch all budget line items
  // Compute summary metrics
  // Mutations for updating spend/forecast

  interface UseBudgetReturn {
    items: BudgetLineItem[];
    summary: {
      totalBudget: number;
      totalSpent: number;
      totalCommitted: number;
      totalForecasted: number;
      variance: number;
      variancePercent: number;
      overBudgetCount: number;
    };
    isLoading: boolean;
    error: Error | null;
    updateItem: (id: string, input: UpdateBudgetLineItemInput) => Promise<BudgetLineItem>;
  }
}
```

### 3.8 useFiles Hook

```typescript
export function useFiles(
  projectId: string,
  filters?: FileFilters,
  pageSize: number = 100
): UseFilesReturn {
  // List files
  // Upload file with progress
  // Generate signed URLs
  // Delete file

  interface UseFilesReturn {
    files: ProjectFile[];
    isLoading: boolean;
    error: Error | null;
    upload: (file: File, category: string, relatedEntity?: { type: string; id: string }) => Promise<ProjectFile>;
    uploadProgress: number; // 0-100
    getSignedUrl: (storagePath: string) => Promise<string>;
    delete: (id: string) => Promise<void>;
  }
}
```

---

## 4. Optimistic Update Pattern

Optimistic updates improve UX by immediately reflecting changes on screen before server confirmation.

```typescript
export function useOptimisticRFI(projectId: string) {
  const { supabase } = useSupabaseClient();
  const queryClient = useQueryClient();

  const updateRFIOptimistic = async (
    rfiId: string,
    input: UpdateRFIInput
  ): Promise<RFI> => {
    // Get current data from cache
    const queryKey = ['rfis', projectId];
    const previousData = queryClient.getQueryData(queryKey) as { data: RFI[] } | undefined;

    // Optimistically update the cache
    if (previousData) {
      queryClient.setQueryData(queryKey, {
        ...previousData,
        data: previousData.data.map(rfi =>
          rfi.id === rfiId
            ? { ...rfi, ...input, updated_at: new Date().toISOString() }
            : rfi
        )
      });
    }

    try {
      // Make the API call
      const result = await updateRFI(projectId, rfiId, input);
      // Query is already updated optimistically, just refetch to ensure sync
      queryClient.invalidateQueries(queryKey);
      return result;
    } catch (error) {
      // Rollback on error
      if (previousData) {
        queryClient.setQueryData(queryKey, previousData);
      }
      throw error;
    }
  };

  return { updateRFIOptimistic };
}
```

---

## 5. File Upload Pattern

Uploads to Supabase Storage with progress tracking and image compression.

```typescript
export async function uploadProjectFile(
  projectId: string,
  file: File,
  category: ProjectFile['category'],
  options?: {
    compressImages?: boolean;
    maxImageWidth?: number;
    relatedEntity?: { type: string; id: string };
    onProgress?: (percent: number) => void;
  }
): Promise<ProjectFile> {
  const { supabase } = useSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  // Compress images if requested
  let fileToUpload = file;
  if (options?.compressImages && file.type.startsWith('image/')) {
    fileToUpload = await compressImage(file, options.maxImageWidth || 1920);
  }

  // Generate unique storage path
  const timestamp = Date.now();
  const filename = `${projectId}/${category}/${timestamp}-${file.name}`;

  // Upload to Supabase Storage
  const { data, error: uploadError } = await supabase.storage
    .from('project-files')
    .upload(filename, fileToUpload, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  if (!data) throw new Error('Upload returned no data');

  // Create file record in database
  const { data: fileRecord, error: dbError } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      name: file.name,
      file_type: file.type,
      file_size_bytes: fileToUpload.size,
      storage_path: data.path,
      category,
      uploaded_by: user.id,
      related_entity_type: options?.relatedEntity?.type || null,
      related_entity_id: options?.relatedEntity?.id || null
    })
    .select()
    .single();

  if (dbError) throw new Error(`Failed to create file record: ${dbError.message}`);

  options?.onProgress?.(100);
  return fileRecord;
}

// Image compression helper
async function compressImage(
  file: File,
  maxWidth: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
```

---

## 6. Search Implementation

PostgreSQL full-text search with tsvector for high-performance queries.

```typescript
// Database schema requires tsvector columns:
// ALTER TABLE rfis ADD COLUMN search_text tsvector
//   GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || description)) STORED;
// CREATE INDEX idx_rfis_search ON rfis USING GIN (search_text);

export async function globalSearch(
  projectId: string,
  query: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  type: string; // 'rfi', 'submittal', 'change_order', etc.
  title: string;
  preview: string;
  relevance: number;
}>> {
  const { supabase } = useSupabaseClient();

  // Search across multiple tables
  const [rfis, submittals, changeOrders, dailyLogs] = await Promise.all([
    supabase
      .from('rfis')
      .select('id, title, description')
      .eq('project_id', projectId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit / 4),

    supabase
      .from('submittals')
      .select('id, title, description')
      .eq('project_id', projectId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit / 4),

    supabase
      .from('change_orders')
      .select('id, title, description')
      .eq('project_id', projectId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit / 4),

    supabase
      .from('daily_logs')
      .select('id, date, work_summary')
      .eq('project_id', projectId)
      .ilike('work_summary', `%${query}%`)
      .limit(limit / 4)
  ]);

  const results: Array<{
    id: string;
    type: string;
    title: string;
    preview: string;
    relevance: number;
  }> = [];

  // Process RFI results
  if (rfis.data) {
    rfis.data.forEach(rfi => {
      const relevance = calculateRelevance(query, rfi.title, rfi.description);
      results.push({
        id: rfi.id,
        type: 'rfi',
        title: rfi.title,
        preview: rfi.description.substring(0, 100) + '...',
        relevance
      });
    });
  }

  // Process Submittal results
  if (submittals.data) {
    submittals.data.forEach(sub => {
      const relevance = calculateRelevance(query, sub.title, sub.description);
      results.push({
        id: sub.id,
        type: 'submittal',
        title: sub.title,
        preview: sub.description.substring(0, 100) + '...',
        relevance
      });
    });
  }

  // Similar processing for changeOrders and dailyLogs...

  // Sort by relevance and return top results
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

// Helper: Calculate relevance score
function calculateRelevance(query: string, ...fields: string[]): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  fields.forEach(field => {
    if (!field) return;
    const lowerField = field.toLowerCase();

    // Exact match
    if (lowerField === lowerQuery) score += 100;
    // Starts with
    else if (lowerField.startsWith(lowerQuery)) score += 50;
    // Contains
    else if (lowerField.includes(lowerQuery)) score += 25;
    // Word match
    else if (lowerField.split(' ').some(word => word.startsWith(lowerQuery))) score += 10;
  });

  return score;
}

// Typeahead hook for autocomplete
export function useSearchAutocomplete(
  projectId: string,
  query: string,
  delay: number = 300
) {
  const [results, setResults] = useState<typeof globalSearch extends (...args: any[]) => Promise<infer T> ? T : never>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await globalSearch(projectId, query, 10);
        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [projectId, query, delay]);

  return { results, isLoading };
}
```

---

## 7. Pagination

Cursor-based pagination for efficient data loading and infinite scroll.

```typescript
export interface CursorPaginationOptions {
  cursor?: string; // Opaque cursor from previous page
  pageSize: number;
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string; // Null if at end
  hasMore: boolean;
  pageSize: number;
}

// Cursor-based list (alternative to offset)
export async function listRFIsWithCursor(
  projectId: string,
  options: CursorPaginationOptions
): Promise<CursorPaginationResult<RFI>> {
  const { supabase } = useSupabaseClient();

  let query = supabase
    .from('rfis')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }); // Tiebreaker

  // If cursor provided, fetch from that point
  if (options.cursor) {
    const decodedCursor = Buffer.from(options.cursor, 'base64').toString('utf-8');
    const [created_at, id] = decodedCursor.split('|');
    query = query
      .lt('created_at', created_at)
      .or(`and(created_at.eq.${created_at},id.lt.${id})`);
  }

  // Fetch pageSize + 1 to detect if there are more results
  const { data, error } = await query.limit(options.pageSize + 1);

  if (error) throw new Error(`Failed to list RFIs: ${error.message}`);

  const hasMore = (data?.length || 0) > options.pageSize;
  const pageData = hasMore ? data!.slice(0, options.pageSize) : data || [];

  let nextCursor: string | undefined;
  if (hasMore && pageData.length > 0) {
    const lastItem = pageData[pageData.length - 1];
    const cursor = `${lastItem.created_at}|${lastItem.id}`;
    nextCursor = Buffer.from(cursor).toString('base64');
  }

  return {
    data: pageData,
    nextCursor,
    hasMore,
    pageSize: options.pageSize
  };
}

// Infinite scroll hook using React Query
export function useInfiniteRFIs(
  projectId: string,
  pageSize: number = 50
) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery(
    ['rfis-infinite', projectId],
    ({ pageParam }) =>
      listRFIsWithCursor(projectId, {
        cursor: pageParam,
        pageSize
      }),
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      select: (data) => ({
        pages: data.pages,
        pageParams: data.pageParams,
        items: data.pages.flatMap(page => page.data)
      })
    }
  );

  return {
    items: data?.items || [],
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
    isLoading: status === 'loading',
    isFetchingMore: isFetchingNextPage
  };
}
```

---

## 8. Error Handling

Comprehensive error handling for Supabase and API failures.

```typescript
// Error types from Supabase
export enum SupabaseErrorCode {
  // Authentication
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  WEAK_PASSWORD = 'weak_password',
  SESSION_EXPIRED = 'session_expired',

  // Database
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  DUPLICATE_KEY = '23505',

  // Authorization
  INSUFFICIENT_PERMISSIONS = 'PGRST301',
  POLICY_VIOLATION = 'policy_violation',

  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = '429'
}

export class SitesynError extends Error {
  constructor(
    public code: string,
    public message: string,
    public originalError?: any,
    public statusCode?: number
  ) {
    super(message);
  }
}

// Handle Supabase errors
export function handleSupabaseError(error: any): SitesynError {
  const status = error.status;
  const code = error.code || error.message;

  // Timeout
  if (error.message?.includes('timeout')) {
    return new SitesynError(
      SupabaseErrorCode.TIMEOUT,
      'Request timed out. Please try again.',
      error,
      status
    );
  }

  // Network error
  if (error.message?.includes('fetch')) {
    return new SitesynError(
      SupabaseErrorCode.NETWORK_ERROR,
      'Network error. Check your connection and try again.',
      error,
      status
    );
  }

  // Unique constraint violation
  if (code === SupabaseErrorCode.DUPLICATE_KEY) {
    return new SitesynError(
      code,
      'This item already exists. Use a different name or number.',
      error,
      status
    );
  }

  // Foreign key violation
  if (code === SupabaseErrorCode.FOREIGN_KEY_VIOLATION) {
    return new SitesynError(
      code,
      'Cannot delete this item because it is referenced elsewhere.',
      error,
      status
    );
  }

  // Not null violation
  if (code === SupabaseErrorCode.NOT_NULL_VIOLATION) {
    return new SitesynError(
      code,
      'A required field is missing.',
      error,
      status
    );
  }

  // Session expired
  if (status === 401 || code === SupabaseErrorCode.SESSION_EXPIRED) {
    return new SitesynError(
      SupabaseErrorCode.SESSION_EXPIRED,
      'Your session has expired. Please log in again.',
      error,
      401
    );
  }

  // Permission denied
  if (status === 403 || code === SupabaseErrorCode.INSUFFICIENT_PERMISSIONS) {
    return new SitesynError(
      SupabaseErrorCode.INSUFFICIENT_PERMISSIONS,
      'You do not have permission to perform this action.',
      error,
      403
    );
  }

  // Not found
  if (status === 404) {
    return new SitesynError(
      'NOT_FOUND',
      'The requested item was not found.',
      error,
      404
    );
  }

  // Rate limited
  if (status === 429) {
    return new SitesynError(
      SupabaseErrorCode.RATE_LIMITED,
      'Too many requests. Please wait a moment and try again.',
      error,
      429
    );
  }

  // Generic server error
  if (status && status >= 500) {
    return new SitesynError(
      'SERVER_ERROR',
      'Server error. Please try again later.',
      error,
      status
    );
  }

  // Default
  return new SitesynError(
    'UNKNOWN_ERROR',
    error.message || 'An unexpected error occurred.',
    error,
    status
  );
}

// Retry logic for transient failures
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    retryOn?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    retryOn = (error) => error.statusCode === 429 || error.statusCode >= 500
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not a transient error
      if (!retryOn(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// Example usage in a hook
export function useRFIsWithErrorHandling(projectId: string) {
  const [error, setError] = useState<SitesynError | null>(null);

  const createRFI = useCallback(async (input: CreateRFIInput) => {
    try {
      setError(null);
      return await withRetry(() => createRFI(projectId, input));
    } catch (err: any) {
      const sitesynError = handleSupabaseError(err);
      setError(sitesynError);
      throw sitesynError;
    }
  }, [projectId]);

  const clearError = useCallback(() => setError(null), []);

  return { error, clearError, createRFI };
}
```

---

## Database Schema Reference

For reference, here's the essential schema structure (PostgreSQL):

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  owner TEXT,
  contractor TEXT,
  architect TEXT,
  start_date DATE,
  end_date DATE,
  estimated_budget_cents BIGINT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RFIs
CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  due_date TIMESTAMP,
  closed_date TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  assigned_to UUID REFERENCES auth.users(id),
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMP,
  attachments TEXT[],
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Submittals
CREATE TABLE submittals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  specification_section TEXT,
  status TEXT DEFAULT 'draft',
  due_date DATE NOT NULL,
  submission_date DATE,
  approval_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  submitted_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  review_comments TEXT,
  attachments TEXT[],
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Change Orders
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  status TEXT DEFAULT 'draft',
  cost_impact BIGINT,
  schedule_impact_days INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  submitted_date TIMESTAMP,
  approved_date TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  implementation_date TIMESTAMP,
  attachments TEXT[],
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Daily Logs
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  date DATE NOT NULL,
  weather TEXT,
  temperature_high INTEGER,
  temperature_low INTEGER,
  crew_count INTEGER,
  work_summary TEXT,
  issues_delays TEXT,
  visitors TEXT[],
  safety_incidents INTEGER DEFAULT 0,
  photos TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Punch List Items
CREATE TABLE punch_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  trade TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  due_date DATE,
  completed_date TIMESTAMP,
  approved_date TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  before_photo TEXT,
  after_photo TEXT,
  completion_notes TEXT,
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Drawings
CREATE TABLE drawings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  set_number TEXT,
  name TEXT NOT NULL,
  discipline TEXT,
  file_path TEXT,
  file_size_bytes BIGINT,
  revision TEXT,
  revision_date DATE,
  issued_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  markup_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'current',
  tags TEXT[],
  deleted_at TIMESTAMP
);

-- Budget Line Items
CREATE TABLE budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  csi_code TEXT,
  csi_description TEXT,
  account_code TEXT,
  original_budget_cents BIGINT,
  revised_budget_cents BIGINT,
  spent_to_date_cents BIGINT DEFAULT 0,
  committed_cents BIGINT DEFAULT 0,
  forecasted_final_cost_cents BIGINT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  responsible_party TEXT,
  notes TEXT,
  deleted_at TIMESTAMP
);

-- Schedule Activities
CREATE TABLE schedule_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  activity_id TEXT,
  activity_name TEXT NOT NULL,
  discipline TEXT,
  start_date DATE,
  finish_date DATE,
  planned_duration_days INTEGER,
  actual_start_date DATE,
  actual_finish_date DATE,
  percent_complete INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  critical_path BOOLEAN DEFAULT FALSE,
  predecessor_ids TEXT[],
  successor_ids TEXT[],
  responsible_party TEXT,
  float_days INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  notes TEXT,
  deleted_at TIMESTAMP
);

-- Pay Applications
CREATE TABLE pay_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  app_number INTEGER,
  period_start_date DATE,
  period_end_date DATE,
  application_date TIMESTAMP,
  payment_due_date DATE,
  status TEXT DEFAULT 'draft',
  total_work_completed_cents BIGINT,
  total_materials_stored_cents BIGINT,
  total_contract_sum_to_date_cents BIGINT,
  retainage_percent DECIMAL(5, 2),
  retainage_amount_cents BIGINT,
  previous_application_balance_cents BIGINT,
  amount_due_this_period_cents BIGINT,
  amount_paid_to_date_cents BIGINT,
  balance_due_cents BIGINT,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_date TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP,
  paid_date TIMESTAMP,
  notes TEXT,
  attachments TEXT[],
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

-- Crews
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  trade TEXT,
  foreman_id UUID REFERENCES auth.users(id),
  members UUID[],
  status TEXT DEFAULT 'active',
  start_date DATE,
  expected_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMP,
  location TEXT,
  duration_minutes INTEGER,
  meeting_type TEXT,
  organizer_id UUID REFERENCES auth.users(id),
  attendees UUID[],
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  minutes TEXT,
  attachments TEXT[],
  deleted_at TIMESTAMP
);

-- Project Files
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  category TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  related_entity_type TEXT,
  related_entity_id TEXT,
  tags TEXT[],
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMP
);
```

---

## Implementation Notes

1. **All monetary values** are stored in cents (integers) to avoid floating point precision issues.
2. **Soft deletes** use `deleted_at` timestamps. Always filter them out in queries.
3. **Real-time subscriptions** use Supabase broadcast channels. Ensure you unsubscribe on component unmount.
4. **Authentication** is handled by Supabase Auth. Extract user ID from `session.user.id`.
5. **Error handling** must be comprehensive. Use the patterns provided.
6. **Rate limiting** is enforced at the edge function level (100 requests per minute per user).
7. **File uploads** should compress images client-side before upload to save bandwidth.
8. **Pagination** can use either offset-based (simpler) or cursor-based (more efficient for large datasets).

This specification is the contract between frontend and backend. Any deviation must be documented and approved.
