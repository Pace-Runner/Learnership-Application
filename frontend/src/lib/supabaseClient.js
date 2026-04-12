// Initialize Supabase client for auth and database access
// Also exports a flag to check if env vars are configured (prevents crashes if they're missing)

import { createClient } from '@supabase/supabase-js'

// Load from .env file - add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY there
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if env vars exist before trying to use them
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

// Create client with fallback values if not configured
// (prevents errors, but auth calls will fail gracefully if config is missing)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
