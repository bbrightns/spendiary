import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Who is signed in: Google via Supabase, or the local guest user. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // Supabase reads the session from the sign-in redirect itself (detectSessionInUrl in lib/supabase.ts),
  // stores and refreshes it, and clears the token from the address bar
  useEffect(() => {
    // Supabase hands back a fresh user object on every token refresh (e.g. when you come back to
    // the tab). Keep the current one when it's the same person: a new object would re-run the
    // load below, swap the pages for a loading screen and close any form being filled in.
    const signIn = (next: User) => setUser((prev) => (prev?.id === next.id ? prev : next))

    // initialize() is the same one-time start-up the client already runs; it reports what the redirect said
    supabase.auth.initialize().then(async ({ error }) => {
      // The client empties the hash but leaves a bare "#", and leaves an error in it; tidy the address
      if (window.location.href.endsWith('#') || error) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) signIn(session.user)
      // A sign-in redirect that came back with an error (e.g. the user cancelled at Google)
      else if (error) setAuthError(`Sign-in failed: ${error.message}`)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        signIn(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    setAuthError(null)
    if (!import.meta.env.VITE_API_URL || !import.meta.env.VITE_API_TOKEN) {
      setAuthError('Supabase URL or token is missing in your .env file (see .env.example, or use Test Mode below).')
      return
    }
    // Leaves for Google and comes back to this site with the session in the address
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setAuthError(`Sign-in failed: ${error.message}`)
  }

  const loginAsGuest = () => {
    setAuthError(null)
    const guestUser: User = {
      id: 'guest-user-local',
      app_metadata: { provider: 'guest' },
      user_metadata: { name: 'Guest User' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'guest@spendiary.local',
      role: 'authenticated'
    }
    setUser(guestUser)
  }

  return { user, setUser, authError, setAuthError, loginWithGoogle, loginAsGuest }
}
