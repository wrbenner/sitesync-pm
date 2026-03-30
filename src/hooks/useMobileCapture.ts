// Mobile capture utilities: camera, geolocation, haptics
// Uses Capacitor plugins when running as native app, falls back to web APIs

import { useState, useCallback } from 'react'

interface CaptureResult {
  imageUrl: string | null
  latitude: number | null
  longitude: number | null
  timestamp: string
  heading: number | null
}

export function useMobileCapture() {
  const [capturing, setCapturing] = useState(false)
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null)

  const capturePhoto = useCallback(async (): Promise<CaptureResult | null> => {
    setCapturing(true)
    try {
      let imageUrl: string | null = null
      let latitude: number | null = null
      let longitude: number | null = null
      let heading: number | null = null

      // Try Capacitor Camera first
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          width: 1920,
          height: 1440,
        })
        imageUrl = photo.dataUrl || null
      } catch {
        // Fallback: use file input for web
        imageUrl = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.capture = 'environment'
          input.onchange = () => {
            const file = input.files?.[0]
            if (!file) { resolve(null); return }
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          }
          input.click()
        })
      }

      // Try to get GPS location
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 })
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
        heading = pos.coords.heading
      } catch {
        // Fallback to browser geolocation
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          ).catch(() => null)
          if (pos) {
            latitude = pos.coords.latitude
            longitude = pos.coords.longitude
            heading = pos.coords.heading
          }
        }
      }

      // Haptic feedback
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
        await Haptics.impact({ style: ImpactStyle.Medium })
      } catch {
        // No haptics available
      }

      const result: CaptureResult = {
        imageUrl,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
        heading,
      }
      setLastCapture(result)
      return result
    } finally {
      setCapturing(false)
    }
  }, [])

  return { capturePhoto, capturing, lastCapture }
}

// Hook for haptic feedback
export function useHaptics() {
  const impact = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
      await Haptics.impact({ style: styleMap[style] })
    } catch {
      // No haptics
    }
  }, [])

  const notification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics')
      const typeMap = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }
      await Haptics.notification({ type: typeMap[type] })
    } catch {
      // No haptics
    }
  }, [])

  return { impact, notification }
}
