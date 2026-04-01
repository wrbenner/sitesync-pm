import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F47820',
          navy: '#0F1629',
          teal: '#4EC896',
          amber: '#F5A623',
          danger: '#E74C3C',
          info: '#3B82F6',
        },
        surface: {
          page: '#F7F8FA',
          card: '#FFFFFF',
          sidebar: '#0F1629',
        },
        text: {
          primary: '#1A1A2E',
          muted: '#6B7280',
          disabled: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
}

export default config
