/** The parts of a Supabase AuthError this file reads (also fits the errors initialize() returns after a redirect) */
export interface AuthErrorLike {
  message: string
  code?: string
  status?: number
  name?: string
}

/** What a visitor who isn't invited sees, from Google or from the email code */
export const NOT_INVITED = 'อีเมลนี้ยังไม่ได้รับเชิญ ขอคำเชิญจากคนที่ส่งลิงก์นี้ให้คุณ หรือลองโหมด Demo ก่อน'

/** Supabase's auth errors in Thai, saying what to do next. Unknown errors keep Supabase's own text for support. */
export function authErrorText(error: AuthErrorLike): string {
  const { code, status, name, message } = error
  // Sign-ups are off (invite-only), so an address with no account is an address nobody invited
  if (code === 'signup_disabled' || code === 'otp_disabled' || code === 'user_not_found' || /signups? not allowed/i.test(message)) {
    return NOT_INVITED
  }
  if (code === 'otp_expired') return 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว ดูรหัสในอีเมลล่าสุด หรือกดส่งรหัสใหม่'
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'ขอรหัสถี่เกินไป รอสักครู่แล้วลองใหม่ หรือใช้รหัสล่าสุดที่ได้รับ'
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'รูปแบบอีเมลไม่ถูกต้อง ตรวจแล้วลองอีกครั้ง'
  if (/access_denied|cancel/i.test(`${code ?? ''} ${message}`)) return 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว ลองใหม่ได้ทุกเมื่อ'
  if (name === 'AuthRetryableFetchError' || status === 0 || /failed to fetch|network/i.test(message)) {
    return 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'
  }
  return `เข้าสู่ระบบไม่สำเร็จ: ${message}`
}
