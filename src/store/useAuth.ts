import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Who is signed in: Google via Supabase, or the local guest user. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // Auth setup
  useEffect(() => {
    // If returning with hash tokens from OAuth redirect, extract user from JWT payload safely
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')

        if (accessToken) {
          // Store token in Supabase standard localStorage key
          const projectRef = 'dgxjifbsdpggoyyzhpeb'
          const storageKey = `sb-${projectRef}-auth-token`
          const refreshToken = hashParams.get('refresh_token') || ''
          const expiresIn = Number(hashParams.get('expires_in')) || 3600

          // Parse JWT payload (Base64Url decode)
          const base64Url = accessToken.split('.')[1]
          if (base64Url) {
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            )
            const payload = JSON.parse(jsonPayload)
            console.log('Restored user directly from token payload:', payload.email)

            const restoredUser: User = {
              id: payload.sub || payload.id || 'user-google',
              app_metadata: payload.app_metadata || { provider: 'google' },
              user_metadata: payload.user_metadata || {},
              aud: payload.aud || 'authenticated',
              created_at: new Date().toISOString(),
              email: payload.email || '',
              role: payload.role || 'authenticated'
            }

            const sessionObj = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: expiresIn,
              expires_at: Math.floor(Date.now() / 1000) + expiresIn,
              token_type: 'bearer',
              user: restoredUser
            }
            try {
              localStorage.setItem(storageKey, JSON.stringify(sessionObj))
            } catch {
              // ignore: storage or JSON unavailable
            }

            setUser(restoredUser)
            window.history.replaceState(null, '', window.location.pathname)
          }
        }
      } catch (e) {
        console.error('Error parsing token from hash:', e)
      }
    }

    // Supabase hands back a fresh user object on every token refresh (e.g. when you come back to
    // the tab). Keep the current one when it's the same person: a new object would re-run the
    // load below, swap the pages for a loading screen and close any form being filled in.
    const signIn = (next: User) => setUser((prev) => (prev?.id === next.id ? prev : next))

    if (supabase?.auth?.getSession) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('Initial Supabase session:', session?.user?.email ?? 'No user')
        if (session?.user) {
          signIn(session.user)
        }
      })
    }

    if (supabase?.auth?.onAuthStateChange) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Supabase onAuthStateChange:', event, session?.user?.email ?? 'No user')
        if (session?.user) {
          signIn(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      })
      return () => subscription.unsubscribe()
    }
  }, [])

  const loginWithGoogle = () => {
    setAuthError(null)
    const supabaseUrl = import.meta.env.VITE_API_URL || ''
    const supabaseKey = import.meta.env.VITE_API_TOKEN || ''

    if (!supabaseUrl || !supabaseKey) {
      setAuthError('Supabase URL or token is missing in your .env file (see .env.example, or use Test Mode below).')
      return
    }

    try {
      const redirectUri = encodeURIComponent(window.location.origin)
      const targetUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectUri}`
      console.log('Navigating directly to Supabase Google OAuth URL:', targetUrl)
      window.location.href = targetUrl
    } catch (err) {
      console.error('Sign in exception:', err)
      setAuthError(`Sign-in failed: ${(err instanceof Error && err.message) || 'could not reach Supabase'}`)
    }
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
