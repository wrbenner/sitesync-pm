import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── File Versions ───────────────────────────────────────

export interface FileVersion {
  id: string
  file_id: string
  version_number: number
  file_url: string
  file_size: number | null
  change_description: string | null
  uploaded_by: string | null
  created_at: string
}

const PROJECT_FILES_BUCKET = 'project-files'

/**
 * Attempt to resolve a storage-bucket key into a signed URL. Returns the
 * original value on failure so callers can still use absolute URLs stored
 * directly in file_url (legacy rows).
 */
export async function resolveFileUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storagePath, 60 * 10)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export function useFileVersions(fileId: string | undefined) {
  return useQuery({
    queryKey: ['file_versions', fileId],
    queryFn: async (): Promise<FileVersion[]> => {
      // Primary source: file_versions table
      const { data: versionRows, error: versionErr } = await from('file_versions')
        .select('*')
        .eq('file_id', fileId!)
        .order('version_number', { ascending: false })
      if (versionErr) {
        // Table missing in dev/preview — fall back to an empty list rather
        // than blowing up the panel.
        console.warn('[useFileVersions] file_versions query failed:', versionErr.message)
      }
      const versions = ((versionRows ?? []) as unknown as FileVersion[]).slice()

      // Include the current file row itself as the latest version if it
      // isn't already represented (file_versions usually holds prior edits).
      const { data: currentFile, error: fileErr } = await from('files')
        .select('id, version, file_url, file_size, uploaded_by, created_at')
        .eq('id', fileId!)
        .maybeSingle()
      if (!fileErr && currentFile) {
        const row = currentFile as unknown as {
          id: string
          version: number | null
          file_url: string | null
          file_size: number | null
          uploaded_by: string | null
          created_at: string | null
        }
        const latestRecorded = versions.length > 0 ? versions[0].version_number : 0
        const currentVersionNumber = row.version ?? latestRecorded + 1
        const alreadyListed = versions.some(v => v.version_number === currentVersionNumber)
        if (!alreadyListed) {
          versions.unshift({
            id: `current-${row.id}`,
            file_id: row.id,
            version_number: currentVersionNumber,
            file_url: row.file_url ?? '',
            file_size: row.file_size,
            change_description: 'Current version',
            uploaded_by: row.uploaded_by,
            created_at: row.created_at ?? new Date().toISOString(),
          })
        }
      }

      return versions
    },
    enabled: !!fileId,
  })
}

export interface CreateFileVersionInput {
  file_id: string
  version_number: number
  file_url: string
  file_size?: number | null
  change_description?: string | null
  uploaded_by?: string | null
}

export function useCreateFileVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFileVersionInput) => {
      const { data, error } = await from('file_versions')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as unknown as FileVersion
    },
    onSuccess: (_data: unknown, variables: CreateFileVersionInput) => {
      queryClient.invalidateQueries({ queryKey: ['file_versions', variables.file_id] })
    },
  })
}
