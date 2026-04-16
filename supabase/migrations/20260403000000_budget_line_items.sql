-- Budget line items table: normalized per-CSI-code budget rows
-- with approved changes, revised budget, committed cost, and variance tracking.

create table if not exists public.budget_line_items (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  csi_code            text,
  description         text,
  original_amount     numeric(14, 2),
  approved_changes    numeric(14, 2) default 0,
  revised_budget      numeric(14, 2),
  committed_cost      numeric(14, 2) default 0,
  actual_cost         numeric(14, 2) default 0,
  projected_final     numeric(14, 2),
  variance            numeric(14, 2),
  contingency_original numeric(14, 2),
  contingency_used     numeric(14, 2) default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists budget_line_items_project_id_idx
  on public.budget_line_items(project_id);

create index if not exists budget_line_items_csi_code_idx
  on public.budget_line_items(project_id, csi_code);

-- RLS
alter table public.budget_line_items enable row level security;

create policy "project members can read budget line items"
  on public.budget_line_items for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = budget_line_items.project_id
        and pm.user_id = (select auth.uid())
    )
  );

create policy "project members can insert budget line items"
  on public.budget_line_items for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = budget_line_items.project_id
        and pm.user_id = (select auth.uid())
    )
  );

create policy "project members can update budget line items"
  on public.budget_line_items for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = budget_line_items.project_id
        and pm.user_id = (select auth.uid())
    )
  );

create policy "project members can delete budget line items"
  on public.budget_line_items for delete
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = budget_line_items.project_id
        and pm.user_id = (select auth.uid())
    )
  );
