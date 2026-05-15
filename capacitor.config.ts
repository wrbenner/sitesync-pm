import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sitesyncai.app',
  appName: 'SiteSync',
  webDir: 'dist',
  ios: {
    scheme: 'SiteSync',
    contentInset: 'always',
  },
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      '*.sentry.io',
      '*.posthog.com',
      '*.liveblocks.io',
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
