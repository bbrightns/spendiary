import { describe, expect, it } from 'vitest'
import { authErrorText, NOT_INVITED } from './authErrors'

describe('authErrorText', () => {
  it('treats a disabled sign-up as not invited, from the email code or the Google redirect', () => {
    expect(authErrorText({ code: 'otp_disabled', message: 'Signups not allowed for otp' })).toBe(NOT_INVITED)
    expect(authErrorText({ code: 'signup_disabled', message: 'Signups not allowed for this instance' })).toBe(NOT_INVITED)
    // The redirect error carries only the description, no code
    expect(authErrorText({ message: 'Signups not allowed for this instance' })).toBe(NOT_INVITED)
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
