import { supabase } from './supabase'

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string; error: string | null }> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) return { url: '', error: error.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  return { error: error?.message ?? null }
}

export function getFileUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadProjectFile(projectId: string, file: File): Promise<{ url: string; error: string | null }> {
  const path = `${projectId}/${Date.now()}_${file.name}`
  return uploadFile('project-files', path, file)
}

export async function uploadDrawing(projectId: string, file: File): Promise<{ url: string; error: string | null }> {
  const path = `${projectId}/${Date.now()}_${file.name}`
  return uploadFile('drawings', path, file)
}

export async function uploadFieldCapture(projectId: string, file: File): Promise<{ url: string; error: string | null }> {
  const path = `${projectId}/${Date.now()}_${file.name}`
  return uploadFile('field-captures', path, file)
}

export async function uploadAvatar(userId: string, file: File): Promise<{ url: string; error: string | null }> {
  const path = `${userId}/avatar.${file.name.split('.').pop()}`
  return uploadFile('avatars', path, file)
}
