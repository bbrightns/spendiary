import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_API_URL || ''
const supabaseAnonKey = import.meta.env.VITE_API_TOKEN || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})
