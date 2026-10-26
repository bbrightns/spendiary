import { useEffect, useState } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Who is signed in via Supabase: with Google, or with a one-time code sent by email. */
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

  const supabaseConfigured = () => {
    if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_TOKEN) return true
    setAuthError('Supabase URL or token is missing in your .env file (see .env.example, or use Test Mode below).')
    return false
  }

  const loginWithGoogle = async () => {
    setAuthError(null)
    if (!supabaseConfigured()) return
    // Leaves for Google and comes back to this site with the session in the address
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setAuthError(`Sign-in failed: ${error.message}`)
  }

  // For computers that can't reach Google: the code is read on another device (phone) and typed here,
  // so the session lands on this browser. A link in the email would sign in whichever device opened it.
  // Same address as the Google account → Supabase signs in the same user, so the data is the same.
  /** Emails a one-time code. Existing accounts only: an unknown address gets an error, not a new empty account. */
  const sendEmailCode = async (email: string): Promise<boolean> => {
    setAuthError(null)
    if (!supabaseConfigured()) return false
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (error) setAuthError(emailCodeError(error))
    return !error
  }

  /** Signs in with the emailed code; onAuthStateChange above picks up the new session */
  const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
    setAuthError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) setAuthError(emailCodeError(error))
    return !error
  }

  return { user, setUser, authError, setAuthError, loginWithGoogle, sendEmailCode, verifyEmailCode }
}

/** Supabase's auth errors, in words that say what to do next */
function emailCodeError(error: AuthError): string {
  if (error.code === 'otp_disabled' || error.code === 'signup_disabled' || /signups not allowed/i.test(error.message)) {
    return 'No account uses this email. Sign in with Google once (on any device) to create it, then use the code here.'
  }
  if (error.code === 'otp_expired') return 'That code is wrong or has expired. Check the latest email, or send a new code.'
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return 'Too many codes sent. Wait a while, then try again (or use the last code you received).'
  }
  return `Sign-in failed: ${error.message}`
}
