---
name: zod-api-validation
description: Add Zod schemas for runtime validation of API responses and form inputs
version: "1.0.0"
when_to_use: When creating mutation hooks, form submission handlers, API response handlers, or any function that accepts untrusted external data; when a runtime type error surfaces from unexpected API shape
allowed-tools: read_file, write_file, bash
---

## Overview

TypeScript types are erased at runtime — they provide zero protection against malformed API responses or unexpected null values from Supabase. SiteSync uses Zod schemas co-located with each data hook to validate at the boundary between network and application code. This catches corrupt data early (at the API layer) rather than late (as a mysterious render crash on a job site).

The authoritative pattern in this codebase is the `createAuditedMutation` hook.

## The `createAuditedMutation` Pattern

This is the canonical hook pattern used throughout SiteSync. Study it — all mutation hooks follow this structure:

```typescript
// src/hooks/useCreateDailyLog.ts

import { z } from 'zod';
import { fromTable } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ── 1. Define the Zod schema co-located with the hook ───────────────────────
const DailyLogSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  superintendent_id: z.string().uuid(),
  weather: z.enum(['sunny', 'cloudy', 'rain', 'snow', 'wind']),
  crew_count: z.number().int().min(0).max(999),
  notes: z.string().max(5000).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ── 2. Derive the TypeScript type from the schema (single source of truth) ──
type DailyLog = z.infer<typeof DailyLogSchema>;

// ── 3. Define input schema separately (only the fields the user provides) ───
const CreateDailyLogInputSchema = DailyLogSchema.pick({
  project_id: true,
  date: true,
  weather: true,
  crew_count: true,
  notes: true,
});

type CreateDailyLogInput = z.infer<typeof CreateDailyLogInputSchema>;

// ── 4. The mutation hook with Zod validation ─────────────────────────────────
export function useCreateDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDailyLogInput): Promise<DailyLog> => {
      // Validate input before sending (catches form bugs early)
      const validatedInput = CreateDailyLogInputSchema.parse(input);

      const { data, error } = await fromTable('daily_logs')
        .insert(validatedInput)
        .select()
        .single();

      if (error) throw new Error(`Create daily log failed: ${error.message}`);
      if (!data) throw new Error('No data returned from insert');

      // Validate API response (catches backend schema drift)
      const validated = DailyLogSchema.parse(data);
      return validated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_logs'] });
    },
    onError: (error) => {
      // ZodError has a structured message — log it for debugging
      console.error('[useCreateDailyLog]', error);
    },
  });
}
```

## Zod Schema Building Blocks

Use these patterns to build schemas for any SiteSync entity:

```typescript
import { z } from 'zod';

// UUIDs — Supabase always returns these for primary keys
const UUIDField = z.string().uuid();

// Timestamps — Supabase returns ISO 8601 strings
const TimestampField = z.string().datetime();

// Date-only fields (YYYY-MM-DD)
const DateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Nullable text
const NullableText = z.string().nullable();

// Enums — derive from DB constraint values
const ProjectStatusSchema = z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']);

// Money — stored as integer cents in DB, convert at schema boundary
const CentsField = z.number().int().min(0);

// Partial update (all fields optional)
const ProjectUpdateSchema = ProjectSchema.partial().required({ id: true });

// Array response
const ProjectListSchema = z.array(ProjectSchema);
```

## Query Hook Pattern (Read)

Validation applies to query hooks too:

```typescript
// src/hooks/useProjects.ts
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { fromTable } from '@/lib/supabase';

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']),
  address: z.string().nullable(),
  created_at: z.string().datetime(),
});

const ProjectListSchema = z.array(ProjectSchema);

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await fromTable('projects')
        .select('id, name, status, address, created_at')
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Fetch projects failed: ${error.message}`);

      // Validate — will throw ZodError if API shape changed
      return ProjectListSchema.parse(data ?? []);
    },
  });
}
```

## Handling ZodError

Never let a `ZodError` surface to the user as an unhandled crash. Catch it and degrade gracefully:

```typescript
import { ZodError } from 'zod';

try {
  const validated = MySchema.parse(apiResponse);
  return validated;
} catch (err) {
  if (err instanceof ZodError) {
    // Structured error: err.errors is an array of field-level issues
    const issues = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error(`[Validation] Schema mismatch: ${issues}`);
    
    // Option 1: Throw a user-friendly error
    throw new Error('Received unexpected data format. Please refresh and try again.');
    
    // Option 2: Return a safe default (use only for non-critical data)
    // return [];
  }
  throw err; // Re-throw non-Zod errors
}
```

## Form Validation with Zod + React Hook Form

SiteSync uses Zod schemas directly as React Hook Form resolvers:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const PunchItemFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  location: z.string().min(1, 'Location is required'),
  assignee_id: z.string().uuid('Select a valid assignee'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
});

type PunchItemFormData = z.infer<typeof PunchItemFormSchema>;

function PunchItemForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<PunchItemFormData>({
    resolver: zodResolver(PunchItemFormSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('description')} />
      {errors.description && <span>{errors.description.message}</span>}
      {/* ... other fields */}
    </form>
  );
}
```

## Resolution Steps

### Step 1 — Install Zod (if not present)

```bash
npm list zod || npm install zod
```

### Step 2 — Identify the data shape

Look at the Supabase table definition in `src/types/database.types.ts` or the Supabase Dashboard to understand field names and types.

### Step 3 — Write the Zod schema

Place the schema at the top of the hook file. Map each DB column to a Zod validator.

### Step 4 — Validate at input AND output

- `.parse(input)` before sending to API — catches form/caller bugs
- `.parse(data)` after receiving from API — catches backend drift

### Step 5 — Handle ZodError in onError / catch blocks

Log the structured error, then either throw a user-friendly message or return a safe default.

### Step 6 — Verify no TypeScript issues

```bash
npx tsc --noEmit
```

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Schema and DB type diverge | TypeScript happy but runtime crash | Keep schema and `database.types.ts` in sync; add CI check |
| Using `.safeParse()` but ignoring `.error` | Validation silently passes bad data | Always check `result.success` and handle `result.error` |
| Validating nested relations | `z.object()` doesn't match joined data shape | Extend schema with nested `z.object()` for each join |
| Overly strict schema | Valid data rejected after DB migration | Use `.optional()` on non-critical new fields |
| Duplicating schema between hook and form | Two sources of truth diverge | Define once, use `Schema.pick()` for form subsets |

## Usage Tracking

usage_count: 0
last_used: null
