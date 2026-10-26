import { useEffect, useRef, useState } from 'react'
import { useData } from '../store/DataContext'

/** Digits in the emailed code: Supabase → Authentication → Email → "Email OTP length" */
const CODE_LENGTH = 6
/** Supabase sends one sign-in email per address per 60 s by default; resending sooner only gets an error */
const RESEND_SECONDS = 60

/** Sign-in for computers that can't reach Google: the code goes to the account's email, is read on
 *  any device (a phone) and typed here, so this browser gets the session. Same email → same account. */
export function EmailCodeSignIn() {
  const { sendEmailCode, verifyEmailCode } = useData()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrongCode, setWrongCode] = useState(false)
  const [codeFocused, setCodeFocused] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const codeRef = useRef<HTMLInputElement>(null)

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000))
  useEffect(() => {
    if (!sentTo || resendAt <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [sentTo, resendAt])

  // The field is disabled while a request runs, which drops focus; hand it back for the next try
  useEffect(() => {
    if (sentTo && !busy) codeRef.current?.focus()
  }, [sentTo, busy])

  const requestCode = async (address: string) => {
    if (!address || busy) return
    setBusy(true)
    if (await sendEmailCode(address)) {
      setSentTo(address)
      setCode('')
      setWrongCode(false)
      setNow(Date.now())
      setResendAt(Date.now() + RESEND_SECONDS * 1000)
    }
    setBusy(false)
  }

  const verify = async (value: string) => {
    if (!sentTo || value.length < CODE_LENGTH || busy) return
    setBusy(true)
    // On success the auth listener signs in and this screen goes away
    if (await verifyEmailCode(sentTo, value)) return
    setBusy(false)
    setWrongCode(true)
    setCode('')
  }

  const typeCode = (raw: string) => {
    const value = raw.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(value)
    setWrongCode(false)
    // The last digit signs in, no button press; a pasted or autofilled code lands here whole
    if (value.length === CODE_LENGTH) verify(value)
  }

  const inputClass =
    'h-11 w-full rounded-xl border border-landing-line-strong bg-landing-surface px-3.5 text-base text-landing-ink outline-none transition-colors placeholder:text-landing-ink-faint focus:border-landing-brand focus:ring-2 focus:ring-landing-brand/15'
  const submitClass =
    'w-full h-11 bg-landing-ink hover:bg-landing-ink-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-semibold text-sm transition-colors cursor-pointer'
  const linkClass =
    'text-xs sm:text-sm font-semibold text-landing-link hover:underline cursor-pointer disabled:text-landing-ink-faint disabled:no-underline disabled:cursor-not-allowed'

  if (!open) {
    return (
      <div className="mt-2.5 text-center">
        <button type="button" onClick={() => setOpen(true)} className={linkClass}>
          เข้าใช้งานด้วยอีเมลแทน
        </button>
      </div>
    )
  }

  if (!sentTo) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          requestCode(email.trim().toLowerCase())
        }}
        className="mt-4 space-y-2.5"
      >
        <label htmlFor="signin-email" className="block text-sm font-semibold text-landing-ink-soft">
          อีเมลของคุณ
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-landing-ink-muted">
          เราจะส่งรหัส {CODE_LENGTH} หลักไปที่อีเมลนี้ เปิดอีเมลบนเครื่องไหนก็ได้ เช่นมือถือ แล้วพิมพ์รหัสที่นี่
        </p>
        <button type="submit" disabled={busy || !email.trim()} className={submitClass}>
          {busy ? 'กำลังส่ง…' : 'ส่งรหัส'}
        </button>
      </form>
    )
  }

  // One real input sits invisibly over the boxes, so typing, backspace, paste and the phone's
  // "code from Mail" suggestion all work as in a normal field; the boxes only draw its value.
  const activeBox = Math.min(code.length, CODE_LENGTH - 1)
  return (
    <div className="mt-5">
      <h3 className="font-display font-extrabold text-lg sm:text-xl text-landing-ink tracking-tight">
        กรอกรหัสยืนยัน
      </h3>
      <p className="mt-1.5 text-sm text-landing-ink-soft">
        ส่งรหัส {CODE_LENGTH} หลักไปที่ <span className="font-semibold text-landing-ink break-all">{sentTo}</span>
      </p>
      <button type="button" onClick={() => setSentTo(null)} className={`${linkClass} mt-1`}>
        เปลี่ยนอีเมล
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          verify(code)
        }}
      >
        <label htmlFor="signin-code" className="relative mt-5 grid grid-cols-6 gap-2 sm:gap-2.5">
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const digit = code[i]
            const active = codeFocused && !busy && i === activeBox
            const tone = wrongCode
              ? 'border-landing-loss-ink bg-landing-loss-soft'
              : active
                ? 'border-landing-brand ring-2 ring-landing-brand/15 bg-landing-surface'
                : digit
                  ? 'border-landing-ink-faint bg-landing-surface'
                  : 'border-landing-line-strong bg-landing-surface'
            return (
              <span
                key={i}
                aria-hidden="true"
                className={`flex h-12 sm:h-14 items-center justify-center rounded-xl border font-display text-xl sm:text-2xl font-bold text-landing-ink transition-colors ${tone} ${busy ? 'opacity-60' : ''}`}
              >
                {digit ?? (active ? <span className="h-6 w-0.5 rounded-full bg-landing-ink animate-pulse" /> : '')}
              </span>
            )
          })}
          <input
            id="signin-code"
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`รหัส ${CODE_LENGTH} หลัก`}
            disabled={busy}
            value={code}
            onChange={(e) => typeCode(e.target.value)}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            className="absolute inset-0 h-full w-full cursor-text text-base opacity-0"
          />
        </label>
      </form>

      <div className="mt-5 text-center">
        {busy ? (
          <p className="text-sm font-medium text-landing-ink-soft">กำลังเข้าสู่ระบบ…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-landing-ink">ไม่ได้รับรหัส?</p>
            <p className="mt-0.5 text-xs text-landing-ink-muted">ลองดูในโฟลเดอร์สแปมด้วย</p>
            <button
              type="button"
              disabled={resendIn > 0}
              onClick={() => requestCode(sentTo)}
              className={`${linkClass} mt-2`}
            >
              ส่งรหัสอีกครั้ง
            </button>
            {resendIn > 0 && (
              <p className="mt-0.5 text-xs text-landing-ink-muted tabular-nums">
                ส่งใหม่ได้ใน {Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, '0')}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-landing-lavender p-4 text-left">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-landing-lavender-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-landing-ink">เพื่อความปลอดภัย</p>
          <p className="mt-0.5 text-xs sm:text-sm text-landing-ink-soft leading-relaxed">
            อย่าบอกรหัสนี้กับใคร Spendiary จะไม่ขอรหัสนี้จากคุณทุกกรณี
          </p>
        </div>
      </div>
    </div>
  )
}
