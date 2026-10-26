import { describe, expect, it } from 'vitest'
import { authErrorText, NO_ACCOUNT, SIGNUPS_CLOSED } from './authErrors'

describe('authErrorText', () => {
  it('sends an email code for an unknown address back to Google to create the account', () => {
    expect(authErrorText({ code: 'otp_disabled', message: 'Signups not allowed for otp' })).toBe(NO_ACCOUNT)
    expect(authErrorText({ message: 'Signups not allowed for otp' })).toBe(NO_ACCOUNT)
  })

  it('says sign-ups are closed if they are ever switched off, from the code or the Google redirect', () => {
    expect(authErrorText({ code: 'signup_disabled', message: 'Signups not allowed for this instance' })).toBe(SIGNUPS_CLOSED)
    // The redirect error carries only the description, no code
    expect(authErrorText({ message: 'Signups not allowed for this instance' })).toBe(SIGNUPS_CLOSED)
  })

  it('names the next step for a wrong code, too many requests and a dropped connection', () => {
    expect(authErrorText({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(/send a new code/)
    expect(authErrorText({ status: 429, message: 'For security purposes…' })).toMatch(/Wait a moment/)
    expect(authErrorText({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toMatch(/internet connection/)
  })

  it('says so when the visitor cancels at Google', () => {
    expect(authErrorText({ message: 'access_denied' })).toMatch(/cancelled/)
  })

  it("keeps Supabase's text for anything else", () => {
    expect(authErrorText({ message: 'Database error saving new user' })).toBe('Sign-in failed: Database error saving new user')
  })
})
