import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cHhybWNwcGpmYnRsd3VvYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM1MjQsImV4cCI6MjA5MDI4OTUyNH0.gI_zodUcFN1z5a9k4GC5At4fsPYgWi-99C0ZNcVgmYA'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey
