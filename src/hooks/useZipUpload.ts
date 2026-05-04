import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'

export interface ZipUploadJob {
  id: string
  status: 'queued' | 'downloading' | 'extracting' | 'uploading' | 'completed' | 'failed'
  progress_pct: number
  total_files: number | null
  processed_files: number | null
  failed_files: number | null
  error: string | null
}

interface StartUploadArgs {
  projectId: string
  file: File
  documentType?: string
  bucket?: string
}

interface StartUploadResult {
  jobId: string | null
  storagePath: string
}

async function uploadZipToStorage(args: StartUploadArgs): Promise<StartUploadResult> {
  const bucket = args.bucket ?? 'project-files'
  const timestamp = Date.now()
  const safeName = args.file.name.replace(/[^\w.-]+/g, '_').slice(0, 100)
  const storagePath = `${args.projectId}/zip-uploads/${timestamp}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(storagePath, args.file, {
      contentType: 'application/zip',
      upsert: false,
    })
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

  // Create a tracking job row (optional — table may not exist in every env).
  let jobId: string | null = null
  try {
    const { data, error } = await fromTable('zip_upload_jobs')
      .insert({
        project_id: args.projectId,
        status: 'queued',
        progress_pct: 0,
        storage_path: storagePath,
        original_name: args.file.name,
      } as never)
      .select('id')
      .single()
    if (!error && data) jobId = (data as { id: string }).id
  } catch {
    /* table not available in this env — that's fine */
  }

  return { jobId, storagePath }
}

export function useZipUpload() {
  const queryClient = useQueryClient()
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ZipUploadJob | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPoll = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearPoll(), [])

  const startPolling = useCallback((jobId: string) => {
    clearPoll()
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const { data, error } = await fromTable('zip_upload_jobs')
          .select(
            'id, status, progress_pct, total_files, processed_files, failed_files, error',
          )
          .eq('id' as never, jobId)
          .single()
        if (error) return
        const j = data as ZipUploadJob
        setJob(j)
        if (j.status === 'completed' || j.status === 'failed') {
          clearPoll()
          queryClient.invalidateQueries({ queryKey: ['documents'] })
          queryClient.invalidateQueries({ queryKey: ['drawings'] })
          if (j.status === 'completed') {
            toast.success(`ZIP extracted — ${j.processed_files ?? 0} files`)
          } else {
            toast.error(`ZIP extraction failed${j.error ? `: ${j.error}` : ''}`)
          }
        }
      } catch {
        /* swallow — retry on next interval */
      }
    }, 2000)
  }, [queryClient])

  const mutation = useMutation<ZipUploadJob | { success: boolean }, Error, StartUploadArgs>({
    mutationFn: async (args) => {
      setUploadProgress(10)
      const { jobId, storagePath } = await uploadZipToStorage(args)
      setUploadProgress(40)
      if (jobId) setCurrentJobId(jobId)

      const { data, error } = await supabase.functions.invoke('process-zip-upload', {
        body: {
          project_id: args.projectId,
          storage_path: storagePath,
          job_id: jobId,
          document_type: args.documentType,
          bucket: args.bucket,
        },
      })
      if (error) throw new Error(error.message)

      setUploadProgress(100)

      if (jobId) startPolling(jobId)

      return data ?? { success: true }
    },
    onError: (err) => {
      toast.error(err.message || 'ZIP upload failed')
      setUploadProgress(0)
      clearPoll()
    },
  })

  const reset = useCallback(() => {
    setCurrentJobId(null)
    setJob(null)
    setUploadProgress(0)
    clearPoll()
  }, [])

  return {
    upload: mutation.mutateAsync,
    isUploading: mutation.isPending,
    uploadProgress,
    job,
    jobId: currentJobId,
    error: mutation.error,
    reset,
  }
}
