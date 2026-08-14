/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string | undefined
  readonly VITE_API_TOKEN: string | undefined
  readonly VITE_FINNHUB_API_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@supabase/supabase-js' {
  export interface User {
    id: string
    email?: string
    user_metadata?: {
      avatar_url?: string
      full_name?: string
      name?: string
      [key: string]: any
    }
    app_metadata?: Record<string, any>
    [key: string]: any
  }

  export interface Session {
    user: User | null
    access_token?: string
    refresh_token?: string
    expires_in?: number
    [key: string]: any
  }

  export interface AuthChangeEvent {
    [key: string]: any
  }

  export interface Subscription {
    unsubscribe: () => void
  }

  export interface SupabaseClient {
    auth: {
      getSession: () => Promise<{ data: { session: Session | null }; error: any }>
      onAuthStateChange: (
        callback: (event: string, session: Session | null) => void
      ) => { data: { subscription: Subscription } }
      signInWithOAuth: (options: {
        provider: string
        options?: { redirectTo?: string; [key: string]: any }
      }) => Promise<{ data: any; error: any }>
      signOut: () => Promise<{ error: any }>
    }
    from: (table: string) => {
      select: (columns?: string) => {
        eq: (column: string, value: any) => {
          single: () => Promise<{ data: any; error: any }>
          maybeSingle: () => Promise<{ data: any; error: any }>
        }
        single: () => Promise<{ data: any; error: any }>
        maybeSingle: () => Promise<{ data: any; error: any }>
      }
      upsert: (payload: any) => Promise<{ data?: any; error: any }>
      insert: (payload: any) => Promise<{ data?: any; error: any }>
      update: (payload: any) => Promise<{ data?: any; error: any }>
      delete: () => Promise<{ data?: any; error: any }>
    }
  }

  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): SupabaseClient
}

