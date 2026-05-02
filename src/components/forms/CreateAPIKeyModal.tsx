import React, { useState, useEffect, useCallback } from 'react'
import { z } from 'zod'
import { FormModal, FormBody, FormFooter, FormField, FormInput, FormCheckbox } from './FormPrimitives'
import { Btn } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { toast } from 'sonner'
import { useProjectId } from '../../hooks/useProjectId'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

// ── Zod Schema ─────────────────────────────────────────────

const CreateAPIKeySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  scopes: z.array(z.string())
    .min(1, 'Select at least one scope'),
  expirationDays: z.coerce.number()
    .min(1, 'Expiration must be at least 1 day')
    .max(365, 'Expiration must be 365 days or less')
    .nullable(),
})

type CreateAPIKeyFormData = z.infer<typeof CreateAPIKeySchema>

// ── Props ──────────────────────────────────────────────────

interface CreateAPIKeyModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (apiKey: { id: string; name: string; key: string; key_prefix: string }) => void
}

// ── Scope Definitions ──────────────────────────────────────

const AVAILABLE_SCOPES = [
  { id: 'read', label: 'Read all data', description: 'GET requests only' },
  { id: 'write', label: 'Write all data', description: 'POST, PATCH requests' },
  { id: 'read:rfis', label: 'Read RFIs', description: 'RFI queries only' },
  { id: 'write:rfis', label: 'Write RFIs', description: 'Create and update RFIs' },
  { id: 'read:tasks', label: 'Read Tasks', description: 'Task queries only' },
  { id: 'write:tasks', label: 'Write Tasks', description: 'Create and update tasks' },
  { id: 'read:submittals', label: 'Read Submittals', description: 'Submittal queries only' },
  { id: 'write:submittals', label: 'Write Submittals', description: 'Create and update submittals' },
  { id: 'read:budget', label: 'Read Budget', description: 'Budget and financials' },
  { id: 'admin', label: 'Admin access', description: 'Full access (use with caution)' },
] as const

// ── Draft Persistence (IndexedDB) ──────────────────────────

const DB_NAME = 'sitesync_drafts'
const STORE_NAME = 'form_drafts'
const DRAFT_KEY = 'draft_api_key'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDraft(data: CreateAPIKeyFormData): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, DRAFT_KEY)
    db.close()
  } catch { /* IndexedDB unavailable */ }
}

async function loadDraft(): Promise<CreateAPIKeyFormData | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
      db.close()
    })
  } catch {
    return null
  }
}

async function clearDraft(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY)
    db.close()
  } catch { /* IndexedDB unavailable */ }
}

// ── Component ──────────────────────────────────────────────

export const CreateAPIKeyModal: React.FC<CreateAPIKeyModalProps> = ({ open, onClose, onSuccess }) => {
  const projectId = useProjectId()

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read'])
  const [expirationDays, setExpirationDays] = useState<string>('90')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load draft on open
  useEffect(() => {
    if (!open) return
    loadDraft().then((draft) => {
      if (draft) {
        setName(draft.name)
        setScopes(draft.scopes)
        setExpirationDays(draft.expirationDays != null ? String(draft.expirationDays) : '')
      }
    })
  }, [open])

  // Auto-save draft every 5 seconds
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      saveDraft({
        name,
        scopes,
        expirationDays: expirationDays ? parseInt(expirationDays) : null,
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [open, name, scopes, expirationDays])

  const handleScopeToggle = useCallback((scopeId: string) => {
    setScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    )
    setErrors((prev) => {
      const next = { ...prev }
      delete next.scopes
      return next
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    const formData: CreateAPIKeyFormData = {
      name,
      scopes,
      expirationDays: expirationDays ? parseInt(expirationDays) : null,
    }

    // Validate
    const result = CreateAPIKeySchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        const field = String(err.path[0] ?? '')
        if (field && !fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Your session has expired. Please sign in again.')
        setIsSubmitting(false)
        return
      }
      const response = await fetch('/functions/v1/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          name: result.data.name,
          scopes: result.data.scopes,
          expiresIn: result.data.expirationDays ? result.data.expirationDays * 86400 : null,
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error((errBody as Record<string, string>).message || 'Failed to create API key')
      }

      const apiKey = await response.json()
      await clearDraft()
      toast.success(`API key "${result.data.name}" created`)
      onSuccess(apiKey as { id: string; name: string; key: string; key_prefix: string })
      onClose()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create API key')
    } finally {
      setIsSubmitting(false)
    }
  }, [name, scopes, expirationDays, projectId, onSuccess, onClose])

  return (
    <FormModal open={open} onClose={onClose} title="Create API Key" width={560}>
      <form onSubmit={handleSubmit}>
        <FormBody>
          <FormField label="Key Name" required error={errors.name}>
            <FormInput
              id="api-key-name"
              placeholder="e.g., Production Server, Mobile App"
              value={name}
              onChange={setName}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="Scopes (permissions)" required error={errors.scopes}>
            <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Select which operations this key can perform
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
              {AVAILABLE_SCOPES.map((scope) => (
                <div
                  key={scope.id}
                  style={{
                    padding: spacing['3'],
                    border: `1px solid ${scopes.includes(scope.id) ? colors.primaryOrange : colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    backgroundColor: scopes.includes(scope.id) ? colors.orangeSubtle : 'transparent',
                  }}
                >
                  <FormCheckbox
                    id={`scope-${scope.id}`}
                    label={scope.label}
                    checked={scopes.includes(scope.id)}
                    onChange={() => handleScopeToggle(scope.id)}
                  />
                  <p style={{ margin: `${spacing['1']} 0 0 ${spacing['6']}`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {scope.description}
                  </p>
                </div>
              ))}
            </div>
          </FormField>

          <FormField label="Expiration (days)" error={errors.expirationDays}>
            <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Leave blank for no expiration
            </p>
            <FormInput
              id="api-key-expiration"
              type="number"
              placeholder="e.g., 90"
              value={expirationDays}
              onChange={setExpirationDays}
              disabled={isSubmitting}
            />
          </FormField>
        </FormBody>

        <FormFooter>
          <Btn variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Btn>
          <Btn type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 600ms linear infinite', marginRight: spacing['2'] }} />
                Creating...
              </>
            ) : (
              'Create API Key'
            )}
          </Btn>
        </FormFooter>
      </form>
    </FormModal>
  )
}

export default CreateAPIKeyModal
