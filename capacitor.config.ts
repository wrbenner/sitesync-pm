import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sitesync.pm',
  appName: 'SiteSync PM',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      '*.sentry.io',
      '*.posthog.com',
      '*.liveblocks.io',
      'api.anthropic.com',
      'api.openweathermap.org',
    ],
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullScreen',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
