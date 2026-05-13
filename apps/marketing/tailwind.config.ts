import type { Config } from 'tailwindcss';

// BRT sub-5 — Option A "Construction" palette (Walker pre-auth 2026-05-13).
// Construction navy + safety orange + warm white.
// Inter family loaded via Google Fonts in BaseLayout.

export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1B2D4A',  // construction navy — primary
          accent:  '#E87722',  // safety orange — accent
          highlight: '#FAF8F4', // warm white — page background
          ink:     '#1A1A1A',
          mute:    '#5C5C5C',
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
