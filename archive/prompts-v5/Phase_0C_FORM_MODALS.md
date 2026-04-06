# Phase 0C: Form Modal Audit and Implementation

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

## Audit Status

### Critical Issues Found

**src/pages/Developers.tsx**
- **Line 288-290**: "Create API Key" button triggers `toast.info('Opening API key creation form...')` — NO MODAL COMPONENT
- **Line 311**: EmptyState "Create Key" button triggers `toast.info('Creating API key...')` — NO MODAL COMPONENT
- **Line 353-355**: "Add Endpoint" button triggers `toast.info('Opening webhook endpoint form...')` — NO MODAL COMPONENT
- **Line 411**: EmptyState "Add Endpoint" button triggers `toast.info('Adding endpoint...')` — NO MODAL COMPONENT

All four locations must be replaced with proper modal components following LAW 6 (BULLETPROOF FORMS).

---

## Architecture Law 6: EVERY FORM IS BULLETPROOF

Every form modal MUST implement:

1. **Zod Validation Schema**
   - Define exact field types, constraints, transformations
   - Inline error messages (not server bounce)
   - Field-level validation errors (not form-level)

2. **IndexedDB Draft Auto-Save**
   - Save form state to IndexedDB every 2 seconds (debounced)
   - Resume from saved draft on modal reopen
   - Clear draft on successful submit
   - Show "Draft saved" indicator in modal

3. **Loading Spinner on Submit**
   - Disable all fields and buttons during API call
   - Show indeterminate progress spinner
   - Clear spinner + enable fields on response

4. **Success Toast + Navigation**
   - Show success toast with confirmation message
   - Navigate or refresh list (if configured)
   - Close modal automatically

5. **Failure State Restoration**
   - On error, restore ALL form field values from state
   - Show error toast with actionable message
   - Keep modal open for retry
   - Re-enable all fields immediately

---

## Template: Well-Implemented Modal

Reference implementation from **src/pages/RFIs.tsx** (line 17):

```typescript
import CreateRFIModal from '../components/forms/CreateRFIModal'

// In component:
const [showCreateModal, setShowCreateModal] = useState(false)
const createRFI = useCreateRFI()

// Button:
<Btn onClick={() => setShowCreateModal(true)}>
  <Plus size={16} /> New RFI
</Btn>

// Modal in JSX:
{showCreateModal && (
  <CreateRFIModal
    isOpen={showCreateModal}
    onClose={() => setShowCreateModal(false)}
    onSuccess={() => {
      setShowCreateModal(false)
      // Refresh list or navigate
    }}
  />
)}
```

Other reference implementations:
- `src/pages/Submittals.tsx` — CreateSubmittalModal
- `src/pages/PunchList.tsx` — CreatePunchItemModal
- `src/pages/Tasks.tsx` — CreateTaskModal
- `src/pages/Directory.tsx` — AddContactModal
- `src/pages/Meetings.tsx` — CreateMeetingModal
- `src/pages/ChangeOrders.tsx` — CreateChangeOrderModal

All of these follow LAW 6 exactly.

---

## Implementation Task 1: CreateAPIKeyModal Component

**File Path**: `src/components/forms/CreateAPIKeyModal.tsx` (NEW FILE)

**Complete Implementation**:

```typescript
import React, { useState, useEffect, useMemo } from 'react'
import { Modal, InputField, Btn, Label, Checkbox, Select } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { toast } from 'sonner'
import { z } from 'zod'
import { useProjectId } from '../../hooks/useProjectId'

// ── Zod Schema ─────────────────────────────────────────────────────

const CreateAPIKeySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  scopes: z.array(z.string())
    .min(1, 'Select at least one scope'),
  expirationDays: z.coerce.number()
    .min(1, 'Expiration must be at least 1 day')
    .max(365, 'Expiration must be 365 days or less')
    .nullable(),
})

type CreateAPIKeyFormData = z.infer<typeof CreateAPIKeySchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (apiKey: { id: string; name: string; key: string; key_prefix: string }) => void
}

const availableScopes = [
  { id: 'read', label: 'Read all data', description: 'GET requests only' },
  { id: 'write', label: 'Write all data', description: 'POST, PATCH requests' },
  { id: 'read:rfis', label: 'Read RFIs', description: 'RFI queries only' },
  { id: 'write:rfis', label: 'Write RFIs', description: 'Create, update RFIs' },
  { id: 'read:tasks', label: 'Read Tasks', description: 'Task queries only' },
  { id: 'write:tasks', label: 'Write Tasks', description: 'Create, update tasks' },
  { id: 'read:submittals', label: 'Read Submittals', description: 'Submittal queries only' },
  { id: 'write:submittals', label: 'Write Submittals', description: 'Create, update submittals' },
  { id: 'read:budget', label: 'Read Budget', description: 'Budget and financials' },
  { id: 'admin', label: 'Admin access', description: 'Full access (use with caution)' },
]

// ── Draft Storage ──────────────────────────────────────────────────

const DRAFT_KEY = 'api_key_form_draft'

function saveDraft(data: CreateAPIKeyFormData) {
  try {
    const db = window.indexedDB.open('sitesync_drafts', 1)
    db.onsuccess = () => {
      const transaction = db.result.transaction(['forms'], 'readwrite')
      const store = transaction.objectStore('forms')
      store.put({ key: DRAFT_KEY, data, timestamp: Date.now() })
    }
  } catch (err) {
    console.error('Draft save failed:', err)
  }
}

function loadDraft(): CreateAPIKeyFormData | null {
  try {
    const db = window.indexedDB.open('sitesync_drafts', 1)
    return new Promise((resolve) => {
      db.onsuccess = () => {
        const transaction = db.result.transaction(['forms'], 'readonly')
        const store = transaction.objectStore('forms')
        const request = store.get(DRAFT_KEY)
        request.onsuccess = () => {
          resolve(request.result?.data || null)
        }
      }
      db.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

function clearDraft() {
  try {
    const db = window.indexedDB.open('sitesync_drafts', 1)
    db.onsuccess = () => {
      const transaction = db.result.transaction(['forms'], 'readwrite')
      const store = transaction.objectStore('forms')
      store.delete(DRAFT_KEY)
    }
  } catch (err) {
    console.error('Draft clear failed:', err)
  }
}

// ── Modal Component ────────────────────────────────────────────────

export const CreateAPIKeyModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const projectId = useProjectId()
  const [formData, setFormData] = useState<CreateAPIKeyFormData>({
    name: '',
    scopes: ['read'],
    expirationDays: 90,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof CreateAPIKeyFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)

  // Load draft on mount
  useEffect(() => {
    if (isOpen) {
      loadDraft().then((draft) => {
        if (draft) {
          setFormData(draft)
        }
      })
    }
  }, [isOpen])

  // Auto-save draft with debounce
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      saveDraft(formData)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2000)
    }, 1500)
    return () => clearTimeout(timer)
  }, [formData, isOpen])

  // Validate single field
  const validateField = (field: keyof CreateAPIKeyFormData, value: unknown) => {
    try {
      CreateAPIKeySchema.pick({ [field]: true }).parse({ [field]: value })
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [field]: err.errors[0]?.message || 'Invalid value',
        }))
      }
    }
  }

  const handleFieldChange = (field: keyof CreateAPIKeyFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    validateField(field, value)
  }

  const handleScopeToggle = (scopeId: string) => {
    setFormData((prev) => {
      const scopes = prev.scopes.includes(scopeId)
        ? prev.scopes.filter((s) => s !== scopeId)
        : [...prev.scopes, scopeId]
      validateField('scopes', scopes)
      return { ...prev, scopes }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate entire form
    try {
      CreateAPIKeySchema.parse(formData)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: typeof errors = {}
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as keyof CreateAPIKeyFormData] = error.message
          }
        })
        setErrors(fieldErrors)
        toast.error('Please fix errors and try again')
      }
      return
    }

    setIsSubmitting(true)
    try {
      // Call API to create key
      const response = await fetch(`/functions/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          projectId,
          name: formData.name,
          scopes: formData.scopes,
          expiresIn: formData.expirationDays ? formData.expirationDays * 86400 : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create API key')
      }

      const apiKey = await response.json()

      // Clear draft on success
      clearDraft()

      // Show success and callback
      toast.success(`API key "${formData.name}" created`)
      onSuccess(apiKey)
      onClose()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create API key')
      // Form stays open with values intact for retry
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      title="Create API Key"
      subtitle="Generate a new API key with scoped permissions"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {/* Name Field */}
        <div>
          <Label htmlFor="name">Key Name</Label>
          <InputField
            id="name"
            placeholder="e.g., Production Server, Mobile App"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            disabled={isSubmitting}
            aria-invalid={!!errors.name}
            style={{
              borderColor: errors.name ? colors.statusCritical : undefined,
            }}
          />
          {errors.name && (
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
              {errors.name}
            </p>
          )}
        </div>

        {/* Scopes */}
        <div>
          <Label>Scopes (permissions)</Label>
          <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Select which operations this key can perform
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            {availableScopes.map((scope) => (
              <label
                key={scope.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing['2'],
                  padding: spacing['3'],
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  backgroundColor: formData.scopes.includes(scope.id) ? colors.orangeSubtle : 'transparent',
                  transition: `all 200ms`,
                }}
              >
                <Checkbox
                  checked={formData.scopes.includes(scope.id)}
                  onChange={() => handleScopeToggle(scope.id)}
                  disabled={isSubmitting}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {scope.label}
                  </p>
                  <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {scope.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {errors.scopes && (
            <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
              {errors.scopes}
            </p>
          )}
        </div>

        {/* Expiration */}
        <div>
          <Label htmlFor="expiration">Expiration (days)</Label>
          <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Leave blank for no expiration
          </p>
          <InputField
            id="expiration"
            type="number"
            placeholder="e.g., 90"
            value={formData.expirationDays || ''}
            onChange={(e) => handleFieldChange('expirationDays', e.target.value ? parseInt(e.target.value) : null)}
            disabled={isSubmitting}
            min="1"
            max="365"
          />
          {errors.expirationDays && (
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
              {errors.expirationDays}
            </p>
          )}
        </div>

        {/* Draft Indicator */}
        {draftSaved && (
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.statusActive }}>
            Draft saved
          </p>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'] }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base,
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              fontFamily: typography.fontFamily,
              transition: `all 200ms`,
            }}
          >
            Cancel
          </button>
          <Btn
            type="submit"
            disabled={isSubmitting}
            style={{ flex: 1, opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: `2px solid ${colors.white}`, borderTopColor: 'transparent', animation: 'spin 600ms linear infinite', marginRight: spacing['2'] }} />
                Creating...
              </>
            ) : (
              'Create API Key'
            )}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

export default CreateAPIKeyModal
```

---

## Implementation Task 2: AddWebhookEndpointModal Component

**File Path**: `src/components/forms/AddWebhookEndpointModal.tsx` (NEW FILE)

**Complete Implementation**:

```typescript
import React, { useState, useEffect } from 'react'
import { Modal, InputField, Btn, Label, Checkbox } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { toast } from 'sonner'
import { z } from 'zod'
import { useProjectId } from '../../hooks/useProjectId'
import { Copy, Check } from 'lucide-react'

// ── Zod Schema ─────────────────────────────────────────────────────

const AddWebhookEndpointSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .url('Must be a valid HTTPS URL')
    .refine((url) => url.startsWith('https://'), 'Only HTTPS URLs are supported'),
  events: z.array(z.string())
    .min(1, 'Select at least one event type'),
  secret: z.string()
    .min(16, 'Secret must be at least 16 characters')
    .max(128, 'Secret must be 128 characters or less'),
  retryOnFailure: z.boolean().optional().default(true),
})

type AddWebhookEndpointFormData = z.infer<typeof AddWebhookEndpointSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (webhook: { id: string; url: string; events: string[] }) => void
}

const eventCategories = [
  {
    category: 'RFIs',
    events: ['rfi.created', 'rfi.updated', 'rfi.responded'],
  },
  {
    category: 'Tasks',
    events: ['task.created', 'task.updated', 'task.completed'],
  },
  {
    category: 'Submittals',
    events: ['submittal.created', 'submittal.updated', 'submittal.approved'],
  },
  {
    category: 'Change Orders',
    events: ['change_order.created', 'change_order.approved'],
  },
  {
    category: 'Daily Logs',
    events: ['daily_log.created', 'daily_log.submitted'],
  },
  {
    category: 'Payments',
    events: ['payment.submitted', 'payment.approved', 'payment.completed'],
  },
  {
    category: 'Safety',
    events: ['incident.reported', 'inspection.completed'],
  },
]

const DRAFT_KEY = 'webhook_form_draft'

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return secret
}

export const AddWebhookEndpointModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const projectId = useProjectId()
  const [formData, setFormData] = useState<AddWebhookEndpointFormData>({
    url: '',
    events: [],
    secret: generateSecret(),
    retryOnFailure: true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof AddWebhookEndpointFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        secret: generateSecret(),
      }))
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2000)
    }, 1500)
    return () => clearTimeout(timer)
  }, [formData, isOpen])

  const validateField = (field: keyof AddWebhookEndpointFormData, value: unknown) => {
    try {
      AddWebhookEndpointSchema.pick({ [field]: true }).parse({ [field]: value })
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [field]: err.errors[0]?.message || 'Invalid value',
        }))
      }
    }
  }

  const handleFieldChange = (field: keyof AddWebhookEndpointFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    validateField(field, value)
  }

  const handleEventToggle = (eventId: string) => {
    setFormData((prev) => {
      const events = prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId]
      validateField('events', events)
      return { ...prev, events }
    })
  }

  const handleCopySecret = () => {
    navigator.clipboard.writeText(formData.secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      AddWebhookEndpointSchema.parse(formData)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: typeof errors = {}
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as keyof AddWebhookEndpointFormData] = error.message
          }
        })
        setErrors(fieldErrors)
        toast.error('Please fix errors and try again')
      }
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/functions/v1/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          projectId,
          url: formData.url,
          events: formData.events,
          secret: formData.secret,
          retryOnFailure: formData.retryOnFailure,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create webhook endpoint')
      }

      const webhook = await response.json()
      toast.success(`Webhook endpoint created for ${formData.url}`)
      onSuccess(webhook)
      onClose()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create webhook endpoint')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      title="Add Webhook Endpoint"
      subtitle="Configure a URL to receive real time event notifications"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {/* URL Field */}
        <div>
          <Label htmlFor="url">Endpoint URL</Label>
          <InputField
            id="url"
            type="url"
            placeholder="https://your-server.com/webhooks/sitesync"
            value={formData.url}
            onChange={(e) => handleFieldChange('url', e.target.value)}
            disabled={isSubmitting}
            aria-invalid={!!errors.url}
            style={{
              borderColor: errors.url ? colors.statusCritical : undefined,
            }}
          />
          {errors.url && (
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
              {errors.url}
            </p>
          )}
        </div>

        {/* Secret */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
            <Label htmlFor="secret">Webhook Secret</Label>
            <button
              type="button"
              onClick={handleCopySecret}
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                border: 'none',
                backgroundColor: 'transparent',
                color: colors.orangeText,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
              }}
            >
              {secretCopied ? (
                <>
                  <Check size={12} /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
          </div>
          <div style={{
            padding: spacing['3'],
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.base,
            fontFamily: typography.fontFamilyMono,
            fontSize: typography.fontSize.caption,
            color: colors.textPrimary,
            wordBreak: 'break-all',
            userSelect: 'all',
          }}>
            {formData.secret}
          </div>
          <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Store this secret safely. You will not be able to view it again.
          </p>
        </div>

        {/* Events */}
        <div>
          <Label>Event Types</Label>
          <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Which events should trigger webhooks
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {eventCategories.map((cat) => (
              <div key={cat.category}>
                <p style={{ margin: 0, marginBottom: spacing['1'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {cat.category}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['2'] }}>
                  {cat.events.map((evt) => (
                    <label
                      key={evt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['2'],
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Checkbox
                        checked={formData.events.includes(evt)}
                        onChange={() => handleEventToggle(evt)}
                        disabled={isSubmitting}
                      />
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontFamily: typography.fontFamilyMono }}>
                        {evt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {errors.events && (
            <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
              {errors.events}
            </p>
          )}
        </div>

        {/* Retry */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}>
          <Checkbox
            checked={formData.retryOnFailure}
            onChange={(e) => handleFieldChange('retryOnFailure', e.target.checked)}
            disabled={isSubmitting}
          />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
            Automatically retry failed deliveries
          </span>
        </label>

        {draftSaved && (
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.statusActive }}>
            Draft saved
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'] }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base,
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              fontFamily: typography.fontFamily,
            }}
          >
            Cancel
          </button>
          <Btn type="submit" disabled={isSubmitting} style={{ flex: 1 }}>
            {isSubmitting ? 'Creating...' : 'Create Endpoint'}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

export default AddWebhookEndpointModal
```

---

## Integration Task 3: Update Developers.tsx

**File Path**: `src/pages/Developers.tsx`

Replace the four placeholder button handlers with proper modal state and components.

**Change 1 (Lines 1-12): Add imports**

```typescript
// REPLACE:
import CreateRFIModal from '../components/forms/CreateRFIModal'

// WITH:
import CreateRFIModal from '../components/forms/CreateRFIModal'
import CreateAPIKeyModal from '../components/forms/CreateAPIKeyModal'
import AddWebhookEndpointModal from '../components/forms/AddWebhookEndpointModal'
```

**Change 2 (Lines 218-228): Add state**

```typescript
// ADD after line 228:
const [showCreateKeyModal, setShowCreateKeyModal] = useState(false)
const [showAddEndpointModal, setShowAddEndpointModal] = useState(false)
```

**Change 3 (Line 288): Replace Create API Key button**

```typescript
// REPLACE:
<Btn onClick={() => toast.info('Opening API key creation form...')} size="sm">
  <Plus size={14} /> Create API Key
</Btn>

// WITH:
<Btn onClick={() => setShowCreateKeyModal(true)} size="sm">
  <Plus size={14} /> Create API Key
</Btn>
```

**Change 4 (Line 311): Replace EmptyState action**

```typescript
// REPLACE:
action={<Btn onClick={() => toast.info('Creating API key...')} size="sm"><Plus size={14} /> Create Key</Btn>}

// WITH:
action={<Btn onClick={() => setShowCreateKeyModal(true)} size="sm"><Plus size={14} /> Create Key</Btn>}
```

**Change 5 (Line 353): Replace Add Endpoint button**

```typescript
// REPLACE:
<Btn onClick={() => toast.info('Opening webhook endpoint form...')} size="sm">
  <Plus size={14} /> Add Endpoint
</Btn>

// WITH:
<Btn onClick={() => setShowAddEndpointModal(true)} size="sm">
  <Plus size={14} /> Add Endpoint
</Btn>
```

**Change 6 (Line 411): Replace EmptyState action**

```typescript
// REPLACE:
action={<Btn onClick={() => toast.info('Adding endpoint...')} size="sm"><Plus size={14} /> Add Endpoint</Btn>}

// WITH:
action={<Btn onClick={() => setShowAddEndpointModal(true)} size="sm"><Plus size={14} /> Add Endpoint</Btn>}
```

**Change 7 (After closing PageContainer tag): Add modals to JSX**

```typescript
// ADD before closing fragment/component:
{showCreateKeyModal && (
  <CreateAPIKeyModal
    isOpen={showCreateKeyModal}
    onClose={() => setShowCreateKeyModal(false)}
    onSuccess={(apiKey) => {
      toast.success(`API key "${apiKey.name}" created and copied to clipboard`)
      navigator.clipboard.writeText(apiKey.key)
      // Refresh API keys list if using react-query
      setShowCreateKeyModal(false)
    }}
  />
)}

{showAddEndpointModal && (
  <AddWebhookEndpointModal
    isOpen={showAddEndpointModal}
    onClose={() => setShowAddEndpointModal(false)}
    onSuccess={(webhook) => {
      // Refresh webhooks list if using react-query
      setShowAddEndpointModal(false)
    }}
  />
)}
```

---

## Audit Task 4: Verify Other Pages

Audit these pages to ensure all `handleAdd()` functions use proper modals (not inline state toggles):

- `src/pages/Financials.tsx` — Check all create/add handlers
- `src/pages/Safety.tsx` — Check incident/inspection creation
- `src/pages/Sustainability.tsx` — Check sustainability log creation
- `src/pages/Equipment.tsx` — Check equipment tracking creation
- `src/pages/Workforce.tsx` — Check crew/staff management creation
- `src/pages/Procurement.tsx` — Check purchase order/requisition creation
- `src/pages/Estimating.tsx` — Check estimate creation
- `src/pages/Permits.tsx` — Check permit application creation
- `src/pages/Warranties.tsx` — Check warranty tracking creation

Each must have:
1. Modal state (boolean)
2. Modal component imported and rendered
3. Modal component following LAW 6 exactly

---

## Validation Checklist

After implementing all changes:

- [ ] CreateAPIKeyModal component created and exports correctly
- [ ] AddWebhookEndpointModal component created and exports correctly
- [ ] Both modals use Zod for validation (exact field errors shown inline)
- [ ] Both modals save drafts to IndexedDB and restore on reopen
- [ ] Both modals show loading spinner during submission
- [ ] Both modals show success toast and close on success
- [ ] Both modals restore state and keep open on error
- [ ] Developers.tsx imports both modals
- [ ] Developers.tsx has showCreateKeyModal and showAddEndpointModal state
- [ ] All four buttons in Developers.tsx now call setShowCreateKeyModal or setShowAddEndpointModal
- [ ] Modals are rendered at bottom of Developers return JSX
- [ ] No toast.info() placeholders remain in button handlers
- [ ] All pages with handleAdd() reviewed for modal compliance
- [ ] No regressions in existing functionality

