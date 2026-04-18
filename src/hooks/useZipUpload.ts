// ── useZipUpload ─────────────────────────────────────────────
// Mutation hook that uploads a ZIP to storage and invokes the
// process-zip-upload edge function. Subscribes to Supabase Realtime
// for per-file progress events.

import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface UploadResultItem {
  name: string
  status: 'uploaded' | 'duplicate' | 'skipped' | 'error'
  error?: string
  path?: string
  document_id?: string
}

export interface ZipUploadSummary {
  total: number
  uploaded: number
  duplicates: number
  skipped: number
  errors: number
  results: UploadResultItem[]
}

export interface ZipUploadInput {
  projectId: string
  file: File
  destBucket?: string
  destPrefix?: string
  autoClassify?: boolean
}

export interface ZipProgressEvent {
  zip_path: string
  processed: number
  current: string
  discipline: string
}

export function useZipUpload() {
  const qc = useQueryClient()

  return useMutation<ZipUploadSummary, Error, ZipUploadInput>({
    mutationFn: async ({ projectId, file, destBucket, destPrefix, autoClassify = true }) => {
      const path = `zips/${projectId}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('project-files').upload(path, file, {
        cacheControl: '3600', upsert: false,
      })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

      const { data, error } = await supabase.functions.invoke('process-zip-upload', {
        body: {
          project_id: projectId,
          zip_path: path,
          dest_bucket: destBucket,
          dest_prefix: destPrefix,
          auto_classify: autoClassify,
        },
      })
      if (error) throw new Error(error.message)
      return data as ZipUploadSummary
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['documents', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['drawing_classifications', 'project', vars.projectId] })
    },
  })
}

/** Subscribe to per-file progress broadcasts from process-zip-upload. */
export function useZipUploadProgress(projectId: string | undefined) {
  const [events, setEvents] = useState<ZipProgressEvent[]>([])

  useEffect(() => {
    if (!projectId) return
    const channel = supabase.channel(`zip-upload:${projectId}`)
    channel.on('broadcast', { event: 'progress' }, (payload) => {
      const p = (payload.payload ?? payload) as ZipProgressEvent
      setEvents((prev) => [...prev, p])
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId])

  const clear = useCallback(() => setEvents([]), [])
  return { events, clear, latest: events[events.length - 1] }
}
