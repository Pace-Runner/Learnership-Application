/**
 * ============================================================================
 * supabaseClient.js - Supabase Database & Auth Client
 * ============================================================================
 * Initializes the Supabase client for authentication and database access.
 * Exports a singleton instance used throughout the app with hasSupabaseConfig flag
 * to gracefully handle missing credentials during development.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * ENVIRONMENT VARIABLES
 * These must be set in .env file:
 * - VITE_SUPABASE_URL: Your Supabase project URL from Project Settings > API
 * - VITE_SUPABASE_ANON_KEY: Public anonymous key for frontend access
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Configuration Validation Flag
 * Used throughout app to prevent auth calls when credentials are missing.
 * Set to false during development if you haven't configured .env yet.
 */
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Supabase Client Instance
 * HARD PART: Uses placeholder values if env vars are missing to prevent runtime crashes.
 * Always check hasSupabaseConfig before making auth/db calls.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
