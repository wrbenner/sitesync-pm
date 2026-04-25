/**
 * File upload validation service (inspired by Clammit file scanning patterns).
 * Validates file type, size, and content before upload to Supabase Storage.
 */

// Allowed MIME types by category
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/tiff',
    'image/bmp',
  ],
  drawings: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/dxf',
    'application/dwg',
    'image/vnd.dwg',
  ],
  models: [
    'application/octet-stream', // IFC files
    'model/gltf-binary',
    'model/gltf+json',
  ],
  video: [
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ],
}

// Max file sizes in bytes
const MAX_FILE_SIZES: Record<string, number> = {
  documents: 100 * 1024 * 1024, // 100MB
  images: 50 * 1024 * 1024,     // 50MB
  drawings: 500 * 1024 * 1024,  // 500MB (construction drawings can be large)
  models: 2 * 1024 * 1024 * 1024, // 2GB for BIM models
  video: 500 * 1024 * 1024,     // 500MB
  default: 100 * 1024 * 1024,   // 100MB fallback
}

// Dangerous file extensions that should always be blocked
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.vbs', '.vbe', '.js', '.jse',
  '.wsh', '.wsf', '.scr', '.pif', '.msi', '.msp', '.mst',
  '.cpl', '.hta', '.inf', '.ins', '.isp', '.reg', '.rgs',
  '.sct', '.shb', '.shs', '.ws', '.wsc', '.lnk', '.ps1',
]

export interface FileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  fileInfo: {
    name: string
    size: number
    type: string
    extension: string
    category: string | null
  }
}

export interface FileValidationOptions {
  category?: string          // documents | images | drawings | models | video
  maxSizeOverride?: number   // override max size in bytes
  allowedTypesOverride?: string[]  // override allowed MIME types
  requireExtension?: boolean // require file to have extension
}

/** Detect file category from MIME type */
export function detectFileCategory(mimeType: string): string | null {
  for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) return category
  }
  return null
}

/** Get file extension from filename */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : ''
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Validate a single file before upload */
export function validateFile(file: File, options: FileValidationOptions = {}): FileValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const extension = getFileExtension(file.name)
  const category = options.category || detectFileCategory(file.type)

  // 1. Check blocked extensions
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    errors.push(`File type "${extension}" is not allowed for security reasons.`)
  }

  // 2. Check file has extension
  if (options.requireExtension !== false && !extension) {
    warnings.push('File has no extension. It may not display correctly.')
  }

  // 3. Check MIME type
  const allowedTypes = options.allowedTypesOverride || (category ? ALLOWED_MIME_TYPES[category] : null)
  if (allowedTypes && !allowedTypes.includes(file.type) && file.type !== '') {
    errors.push(`File type "${file.type}" is not allowed for ${category || 'this'} category. Allowed: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`)
  }

  // 4. Check file size
  const maxSize = options.maxSizeOverride || (category ? MAX_FILE_SIZES[category] : MAX_FILE_SIZES.default)
  if (file.size > maxSize) {
    errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum of ${formatFileSize(maxSize)}.`)
  }

  // 5. Check for zero-size files
  if (file.size === 0) {
    errors.push('File is empty (0 bytes).')
  }

  // 6. Warn on very large files
  if (file.size > 50 * 1024 * 1024 && errors.length === 0) {
    warnings.push(`Large file (${formatFileSize(file.size)}). Upload may take a while.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension,
      category,
    },
  }
}

/** Validate multiple files (for batch upload) */
export function validateFiles(files: File[], options: FileValidationOptions = {}): {
  results: FileValidationResult[]
  allValid: boolean
  totalSize: number
  summary: string
} {
  const results = files.map(f => validateFile(f, options))
  const allValid = results.every(r => r.valid)
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  const invalidCount = results.filter(r => !r.valid).length
  const summary = allValid
    ? `${files.length} file(s) ready to upload (${formatFileSize(totalSize)})`
    : `${invalidCount} of ${files.length} file(s) have validation errors`

  return { results, allValid, totalSize, summary }
}

/** Check if a file is an image (useful for thumbnail generation) */
export function isImageFile(file: File | { type: string; name: string }): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name)
}

/** Check if a file is a PDF */
export function isPdfFile(file: File | { type: string; name: string }): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}
