import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { loadFont as loadDisplay } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as loadSans } from '@remotion/google-fonts/Inter'

const { fontFamily: display } = loadDisplay('normal', { weights: ['600', '700', '800'], subsets: ['latin'] })
const { fontFamily: sans } = loadSans('normal', { weights: ['500', '600'], subsets: ['latin'] })

// Brand: the app's indigo, on a deep night background
const BRAND = '#4f46e5'
const BRAND_SOFT = '#a5b4fc'
const INK = '#f8fafc'
const MUTED = '#c7d2fe'

/** One feature: a caption above a phone showing that screen. */
interface Feature {
  shot: string
  kicker: string
  title: string
  sub: string
  /** Slow pan inside the screen: from / to vertical position (0 = top) as a share of the overflow */
  pan?: [number, number]
}

const FEATURES: Feature[] = [
  { shot: 'home', kicker: 'Today', title: 'Know what you can\nspend today', sub: 'A daily allowance from your budget' },
  { shot: 'quickadd', kicker: 'Quick add', title: 'Log it in\ntwo taps', sub: 'Categories, #tags, any wallet or card' },
  { shot: 'palette', kicker: 'Just type it', title: '“65 coffee”\nand it’s done', sub: 'Smart search fills it in for you' },
  { shot: 'paybill', kicker: 'Credit cards', title: 'Never miss\na card bill', sub: 'Pay in full, the minimum, or early' },
  { shot: 'trends', kicker: 'Analysis', title: 'See where your\nmoney goes', sub: '6-month trends and top categories' },
  { shot: 'goals', kicker: 'Savings goals', title: 'Save for what\nmatters', sub: 'Know how much to put aside each month' },
  { shot: 'import', kicker: 'Import', title: 'Bring in your\nbank statement', sub: 'CSV in, categories guessed — Thai too' },
]

const INTRO = 75
const SCENE = 96
const OUTRO = 105
export const PROMO_FRAMES = INTRO + FEATURES.length * SCENE + OUTRO

/** Soft moving glow behind everything. */
function Background() {
  const frame = useCurrentFrame()
  const a = Math.sin(frame / 70) * 120
  const b = Math.cos(frame / 90) * 140
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(170deg, #0b1024 0%, #13163a 45%, #1e1b4b 100%)' }}>
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          left: -300 + a,
          top: 150 + b,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.55) 0%, rgba(79,70,229,0) 65%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          right: -260 - a,
          bottom: -120 + b,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0) 65%)',
          filter: 'blur(20px)',
        }}
      />
    </AbsoluteFill>
  )
}

/** iPhone-ish frame around a 390×844 screenshot. */
function Phone({ shot, width, pan }: { shot: string; width: number; pan?: [number, number] }) {
  const frame = useCurrentFrame()
  const screenW = width - 36
  // Screenshots have no status bar, so one is drawn above them (room for the dynamic island)
  const statusH = 72
  const screenH = statusH + screenW * (844 / 390)
  const y = pan ? interpolate(frame, [10, SCENE - 10], pan, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  return (
    <div
      style={{
        width,
        padding: 18,
        borderRadius: 86,
        background: 'linear-gradient(145deg, #2a2f45, #0d1020)',
        boxShadow: '0 60px 120px rgba(0,0,0,0.55), 0 0 0 3px rgba(255,255,255,0.08) inset',
      }}
    >
      <div style={{ position: 'relative', width: screenW, height: screenH, borderRadius: 68, overflow: 'hidden', background: '#fff' }}>
        <div
          style={{
            height: statusH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 44px 0 52px',
            background: '#fdfcf9',
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 26,
            color: '#0b1024',
          }}
        >
          <span>9:41</span>
          <svg width="96" height="22" viewBox="0 0 96 22" fill="#0b1024">
            <rect x="0" y="13" width="5" height="8" rx="1.5" />
            <rect x="8" y="9" width="5" height="12" rx="1.5" />
            <rect x="16" y="5" width="5" height="16" rx="1.5" />
            <rect x="24" y="1" width="5" height="20" rx="1.5" />
            <path d="M46 8.5a14 14 0 0 1 19 0l-2.3 2.4a10.6 10.6 0 0 0-14.4 0Zm4.7 4.7a7.4 7.4 0 0 1 9.6 0L55.5 18Z" />
            <rect x="70" y="3" width="22" height="15" rx="4" fill="none" stroke="#0b1024" strokeWidth="2" opacity="0.5" />
            <rect x="72.5" y="5.5" width="15" height="10" rx="2" />
            <rect x="93.5" y="8" width="2" height="5" rx="1" opacity="0.5" />
          </svg>
        </div>
        <Img src={staticFile(`shots/${shot}.png`)} style={{ width: '100%', transform: `translateY(${-y * 100}%)` }} />
        {/* Dynamic island */}
        <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 42, marginLeft: -75, borderRadius: 30, background: '#05060a' }} />
      </div>
    </div>
  )
}

function FeatureScene({ f, index }: { f: Feature; index: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 120 } })
  const textIn = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 140 } })
  const subIn = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 140 } })
  const exit = interpolate(frame, [SCENE - 12, SCENE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  // Alternate a gentle tilt so consecutive scenes don't feel identical
  const tilt = index % 2 === 0 ? -1 : 1
  const drift = interpolate(frame, [0, SCENE], [0, 1])

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      {/* Caption */}
      <div style={{ position: 'absolute', top: 130, left: 80, right: 80 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '10px 22px',
            borderRadius: 999,
            background: 'rgba(79,70,229,0.28)',
            border: '2px solid rgba(165,180,252,0.45)',
            color: BRAND_SOFT,
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 20}px)`,
          }}
        >
          {f.kicker}
        </div>
        <div
          style={{
            marginTop: 26,
            color: INK,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 86,
            lineHeight: 1.04,
            letterSpacing: -2,
            whiteSpace: 'pre-line',
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 40}px)`,
          }}
        >
          {f.title}
        </div>
        <div
          style={{
            marginTop: 22,
            color: MUTED,
            fontFamily: sans,
            fontWeight: 500,
            fontSize: 38,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 30}px)`,
          }}
        >
          {f.sub}
        </div>
      </div>

      {/* Phone rises in, then drifts slightly */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 610,
          transform: `translateX(-50%) translateY(${(1 - enter) * 700 - drift * 30 + exit * 80}px) rotate(${tilt * (1 - enter) * 6 + tilt * drift * 1.2}deg) scale(${0.94 + enter * 0.06})`,
        }}
      >
        <Phone shot={f.shot} width={640} pan={f.pan} />
      </div>

      {/* Progress dots */}
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 14 }}>
        {FEATURES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 44 : 14,
              height: 14,
              borderRadius: 999,
              background: i === index ? BRAND_SOFT : 'rgba(199,210,254,0.3)',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Intro() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 120 } })
  const title = spring({ frame: frame - 8, fps, config: { damping: 18 } })
  const chip = spring({ frame: frame - 18, fps, config: { damping: 14 } })
  const line = spring({ frame: frame - 26, fps, config: { damping: 20 } })
  const exit = interpolate(frame, [INTRO - 12, INTRO], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - exit, transform: `scale(${1 + exit * 0.08})` }}>
      <Img src={staticFile('logo.png')} style={{ width: 220, height: 220, borderRadius: 54, transform: `scale(${logo})`, boxShadow: '0 30px 80px rgba(79,70,229,0.55)' }} />
      <div style={{ marginTop: 44, color: INK, fontFamily: display, fontWeight: 800, fontSize: 112, letterSpacing: -3, opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>
        Spendiary
      </div>
      <div
        style={{
          marginTop: 26,
          padding: '14px 32px',
          borderRadius: 999,
          background: BRAND,
          color: '#fff',
          fontFamily: display,
          fontWeight: 800,
          fontSize: 44,
          transform: `scale(${chip})`,
          boxShadow: '0 16px 40px rgba(79,70,229,0.5)',
        }}
      >
        NEW · Spend
      </div>
      <div style={{ marginTop: 34, color: MUTED, fontFamily: sans, fontWeight: 500, fontSize: 44, opacity: line, textAlign: 'center' }}>
        Every baht in and out,
        <br />
        right next to your investments
      </div>
    </AbsoluteFill>
  )
}

function Outro() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const a = spring({ frame, fps, config: { damping: 14 } })
  const b = spring({ frame: frame - 10, fps, config: { damping: 18 } })
  const c = spring({ frame: frame - 22, fps, config: { damping: 14 } })
  const pulse = 1 + Math.sin(Math.max(0, frame - 30) / 6) * 0.025
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile('logo.png')} style={{ width: 180, height: 180, borderRadius: 44, transform: `scale(${a})` }} />
      <div
        style={{
          marginTop: 50,
          color: INK,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 92,
          lineHeight: 1.05,
          letterSpacing: -2.5,
          textAlign: 'center',
          opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`,
        }}
      >
        Spend smarter.
        <br />
        Live wealthier.
      </div>
      <div style={{ marginTop: 30, color: MUTED, fontFamily: sans, fontWeight: 500, fontSize: 40, opacity: b }}>Track spending and investing in one app</div>
      <div
        style={{
          marginTop: 70,
          padding: '26px 64px',
          borderRadius: 999,
          background: '#fff',
          color: '#0b1024',
          fontFamily: display,
          fontWeight: 800,
          fontSize: 50,
          transform: `scale(${c * pulse})`,
          boxShadow: '0 20px 60px rgba(165,180,252,0.45)',
        }}
      >
        Try Spend today
      </div>
      <div style={{ marginTop: 34, color: 'rgba(199,210,254,0.7)', fontFamily: sans, fontWeight: 500, fontSize: 32, opacity: c }}>Spendiary v1.17</div>
    </AbsoluteFill>
  )
}

export function SpendPromo() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b1024' }}>
      <Background />
      <Sequence durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {FEATURES.map((f, i) => (
        <Sequence key={f.shot} from={INTRO + i * SCENE} durationInFrames={SCENE}>
          <FeatureScene f={f} index={i} />
        </Sequence>
      ))}
      <Sequence from={INTRO + FEATURES.length * SCENE} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  )
}
