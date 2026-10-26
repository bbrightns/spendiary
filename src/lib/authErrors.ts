/** The parts of a Supabase AuthError this file reads (also fits the errors initialize() returns after a redirect) */
export interface AuthErrorLike {
  message: string
  code?: string
  status?: number
  name?: string
}

/** Email code for an address with no account: codes only sign in existing accounts (shouldCreateUser: false) */
export const NO_ACCOUNT = 'No account uses this email yet. Continue with Google once to create it, then you can sign in with an email code.'
/** Only if sign-ups are ever switched off in Supabase (Authentication → Allow new users to sign up) */
export const SIGNUPS_CLOSED = 'New sign-ups are closed right now. You can still try the demo.'

/** Supabase's auth errors in plain words, saying what to do next. Unknown errors keep Supabase's own text for support. */
export function authErrorText(error: AuthErrorLike): string {
  const { code, status, name, message } = error
  // The email-code path never creates accounts, so an unknown address comes back as "signups not allowed for otp"
  if (code === 'otp_disabled' || code === 'user_not_found' || /signups? not allowed for otp/i.test(message)) return NO_ACCOUNT
  if (code === 'signup_disabled' || /signups? not allowed/i.test(message)) return SIGNUPS_CLOSED
  if (code === 'otp_expired') return 'That code is wrong or has expired. Check the latest email, or send a new code.'
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many codes requested. Wait a moment and try again, or use the last code you received.'
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') return "That email address doesn't look right. Check it and try again."
  if (/access_denied|cancel/i.test(`${code ?? ''} ${message}`)) return 'Google sign-in was cancelled. You can try again any time.'
  if (name === 'AuthRetryableFetchError' || status === 0 || /failed to fetch|network/i.test(message)) {
    return "Couldn't connect. Check your internet connection and try again."
  }
  return `Sign-in failed: ${message}`
}
