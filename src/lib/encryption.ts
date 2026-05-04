// Field-level encryption for sensitive construction data.
// Uses Supabase Vault for key management.
// Encrypts: SSNs, financial amounts, contract terms.

import { supabase } from './supabase'
import { fromTable } from '../lib/db/queries'

// ── Types ────────────────────────────────────────────────

export interface EncryptedField {
  entityType: string
  entityId: string
  fieldName: string
  vaultSecretId: string
}

// Fields that should be encrypted when stored
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  workers: ['ssn', 'tax_id'],
  contracts: ['terms', 'penalty_clauses'],
  budget_items: ['negotiated_rate', 'margin'],
  change_orders: ['internal_cost', 'markup'],
}

// ── Encrypt/Decrypt via Supabase Vault ───────────────────

export async function encryptField(
  projectId: string,
  entityType: string,
  entityId: string,
  fieldName: string,
  plaintext: string
): Promise<string> {
  // Store the plaintext in Supabase Vault (encrypted at rest by Vault)
  const { data, error } = await supabase.rpc('vault.create_secret', {
    new_secret: plaintext,
    new_name: `${entityType}:${entityId}:${fieldName}`,
    new_description: `Encrypted field for ${entityType}.${fieldName}`,
  })

  if (error) throw new Error(`Encryption failed: ${error.message}`)

  const vaultSecretId = data as string

  // Store the reference (not the plaintext) in our tracking table
  await fromTable('encrypted_fields').upsert({
    project_id: projectId,
    entity_type: entityType,
    entity_id: entityId,
    field_name: fieldName,
    vault_secret_id: vaultSecretId,
  } as never, { onConflict: 'entity_type,entity_id,field_name' })

  // Return a masked placeholder for the UI
  return maskValue(plaintext)
}

export async function decryptField(
  entityType: string,
  entityId: string,
  fieldName: string
): Promise<string | null> {
  // Look up the vault reference
  const { data: ref } = await fromTable('encrypted_fields')
    .select('vault_secret_id')
    .eq('entity_type' as never, entityType)
    .eq('entity_id' as never, entityId)
    .eq('field_name' as never, fieldName)
    .single()

  if (!ref?.vault_secret_id) return null

  // Retrieve from Vault
  const { data, error } = await supabase.rpc('vault.read_secret', {
    secret_id: ref.vault_secret_id,
  })

  if (error) throw new Error(`Decryption failed: ${error.message}`)
  return data as string
}

// ── Helpers ──────────────────────────────────────────────

function maskValue(value: string): string {
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}

export function isSensitiveField(entityType: string, fieldName: string): boolean {
  return SENSITIVE_FIELDS[entityType]?.includes(fieldName) ?? false
}
