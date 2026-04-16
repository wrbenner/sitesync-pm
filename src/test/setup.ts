import '@testing-library/jest-dom'

// Polyfill window.matchMedia for jsdom (used by useReducedMotion)
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
}

// Provide default Supabase env vars for tests (prevents "supabaseUrl is required" errors)
if (!import.meta.env.VITE_SUPABASE_URL) {
  (import.meta as unknown).env.VITE_SUPABASE_URL = 'https://test.supabase.co'
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  (import.meta as unknown).env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.test-key'
}
