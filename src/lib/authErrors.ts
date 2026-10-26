/** The parts of a Supabase AuthError this file reads (also fits the errors initialize() returns after a redirect) */
export interface AuthErrorLike {
  message: string
  code?: string
  status?: number
  name?: string
}

/** What a visitor who isn't invited sees, from Google or from the email code */
export const NOT_INVITED = "This email hasn't been invited yet. Ask the person who sent you this link for an invite, or try the demo first."

/** Supabase's auth errors in plain words, saying what to do next. Unknown errors keep Supabase's own text for support. */
export function authErrorText(error: AuthErrorLike): string {
  const { code, status, name, message } = error
  // Sign-ups are off (invite-only), so an address with no account is an address nobody invited
  if (code === 'signup_disabled' || code === 'otp_disabled' || code === 'user_not_found' || /signups? not allowed/i.test(message)) {
    return NOT_INVITED
  }
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
