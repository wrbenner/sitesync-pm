// useIFCModel: React hook for loading IFC files into the BIM viewer.
// Manages loading state, progress, and cleanup.

import { useState, useCallback, useRef, useEffect } from 'react'
import { loadIFCFile } from '../services/ifc'
import type { IFCModelData, IFCLoadProgress } from '../services/ifc'

interface UseIFCModelReturn {
  model: IFCModelData | null
  progress: IFCLoadProgress
  isLoading: boolean
  error: string | null
  loadFile: (file: File) => Promise<void>
  reset: () => void
}

const INITIAL_PROGRESS: IFCLoadProgress = {
  phase: 'initializing',
  progress: 0,
  trianglesLoaded: 0,
  message: '',
}

export function useIFCModel(): UseIFCModelReturn {
  const [model, setModel] = useState<IFCModelData | null>(null)
  const [progress, setProgress] = useState<IFCLoadProgress>(INITIAL_PROGRESS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    setModel(null)
    setProgress(INITIAL_PROGRESS)
    abortRef.current = false

    try {
      const buffer = await file.arrayBuffer()

      if (abortRef.current) return

      const result = await loadIFCFile(buffer, file.name, (update) => {
        if (!abortRef.current) setProgress(update)
      })

      if (!abortRef.current) {
        setModel(result)
      }
    } catch (err) {
      if (!abortRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to load IFC file'
        setError(msg)
        setProgress({ phase: 'error', progress: 0, trianglesLoaded: 0, message: msg })
      }
    } finally {
      if (!abortRef.current) setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    // Dispose Three.js geometries and materials
    if (model) {
      for (const mesh of model.meshes) {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose())
        } else {
          mesh.material.dispose()
        }
      }
    }
    setModel(null)
    setProgress(INITIAL_PROGRESS)
    setIsLoading(false)
    setError(null)
  }, [model])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true
    }
  }, [])

  return { model, progress, isLoading, error, loadFile, reset }
}
