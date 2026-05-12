import type { Config } from 'tailwindcss';

// BRT sub-5 — Option B "Modern SaaS" palette (per BRT_FOUNDER_DEFAULTS).
// Inter family loaded via Google Fonts in BaseLayout.

export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F172A',  // slate-900 — primary
          accent:  '#0066FF',  // electric blue — accent
          highlight: '#EEF4FF',
          ink:     '#1A1A1A',
          mute:    '#64748B',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Inter Display"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        prose: '70ch',
      },
    },
  },
} satisfies Config;
