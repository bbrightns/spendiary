import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, type CalculateMetadataFunction } from 'remotion'
import { loadFont as loadDisplay } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as loadSans } from '@remotion/google-fonts/Inter'

const { fontFamily: display } = loadDisplay('normal', { weights: ['600', '700', '800'], subsets: ['latin'] })
const { fontFamily: sans } = loadSans('normal', { weights: ['500', '600'], subsets: ['latin'] })

// The app's light theme (DESIGN.md)
const CANVAS = '#f6f7f9'
const INK = '#0b0d12'
const INK_MUTED = '#555b6a'
const BRAND = '#4f46e5'
const BRAND_SOFT = '#eef0ff'
const BRAND_INK = '#3730a3'

/** Written by record.mjs: one entry per recorded scene, cue times in frames from the scene start. */
export interface Manifest {
  fps: number
  width: number
  height: number
  scenes: {
    id: string
    chapter: string
    file: string
    frames: number
    cues: { at: number; title: string; sub: string }[]
    /** Taps, key presses, toggles and saves, for the sound effects (older manifests have none) */
    sounds?: { at: number; kind: 'tap' | 'key' | 'toggle' | 'success' }[]
  }[]
}
export interface IntroProps {
  manifest: Manifest | null
  /** Music and sound effects; off renders the silent cut */
  withAudio: boolean
  [key: string]: unknown
}

// Music: "Good for You" by THBD, supplied by the owner. Its full section kicks in at 94.55 s and
// is lined up with the start of the Analysis chapter, the payoff of the walkthrough.
const MUSIC = 'good-for-you-by-thbd.mp3'
const MUSIC_DROP_S = 94.55
const MUSIC_ON = 'analysis'
const MUSIC_VOLUME = 0.3
const SFX_VOLUME = { tap: 0.55, key: 0.3, toggle: 0.45, success: 0.55, whoosh: 0.35, chime: 0.6 }

const INTRO = 105
const OUTRO = 150
/** The first scene starts this long before the title card ends, and the end card overlaps the last scene by as much. */
const FADE = 15
/** Where the first scene starts. */
const SCENES = INTRO - FADE

export const calculateIntroMetadata: CalculateMetadataFunction<IntroProps> = async ({ props }) => {
  const manifest: Manifest = await fetch(staticFile('clips/manifest.json')).then((r) => r.json())
  const scenes = manifest.scenes.reduce((s, c) => s + c.frames, 0)
  return { props: { ...props, manifest }, durationInFrames: SCENES + scenes + OUTRO - FADE }
}

function Background() {
  const frame = useCurrentFrame()
  const a = Math.sin(frame / 80) * 110
  const b = Math.cos(frame / 95) * 130
  return (
    <AbsoluteFill style={{ background: `linear-gradient(175deg, ${CANVAS} 0%, #eef0ff 55%, #e7f6ef 100%)` }}>
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          left: -380 + a,
          top: -260 + b,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, rgba(79,70,229,0) 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1000,
          height: 1000,
          right: -360 - a,
          bottom: -260 + b,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(10,157,104,0.16) 0%, rgba(10,157,104,0) 65%)',
        }}
      />
    </AbsoluteFill>
  )
}

const PHONE_W = 660
const BEZEL = 18
const SCREEN_W = PHONE_W - BEZEL * 2
const STATUS_H = 58

/** iPhone-ish frame; the screen content is passed in. */
function Phone({ children, screenH }: { children: React.ReactNode; screenH: number }) {
  return (
    <div
      style={{
        width: PHONE_W,
        padding: BEZEL,
        borderRadius: 88,
        background: 'linear-gradient(145deg, #2a2f45, #0d1020)',
        boxShadow: '0 50px 110px rgba(30,27,75,0.30), 0 0 0 3px rgba(255,255,255,0.10) inset',
      }}
    >
      <div style={{ position: 'relative', width: SCREEN_W, height: STATUS_H + screenH, borderRadius: 70, overflow: 'hidden', background: '#fff' }}>
        <div
          style={{
            height: STATUS_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 46px 0 54px',
            background: '#fdfcfb',
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 24,
            color: INK,
          }}
        >
          <span>9:41</span>
          <svg width="90" height="20" viewBox="0 0 96 22" fill={INK}>
            <rect x="0" y="13" width="5" height="8" rx="1.5" />
            <rect x="8" y="9" width="5" height="12" rx="1.5" />
            <rect x="16" y="5" width="5" height="16" rx="1.5" />
            <rect x="24" y="1" width="5" height="20" rx="1.5" />
            <path d="M46 8.5a14 14 0 0 1 19 0l-2.3 2.4a10.6 10.6 0 0 0-14.4 0Zm4.7 4.7a7.4 7.4 0 0 1 9.6 0L55.5 18Z" />
            <rect x="70" y="3" width="22" height="15" rx="4" fill="none" stroke={INK} strokeWidth="2" opacity="0.5" />
            <rect x="72.5" y="5.5" width="15" height="10" rx="2" />
            <rect x="93.5" y="8" width="2" height="5" rx="1" opacity="0.5" />
          </svg>
        </div>
        <div style={{ position: 'relative', height: screenH }}>{children}</div>
        <div style={{ position: 'absolute', top: 14, left: '50%', width: 140, height: 38, marginLeft: -70, borderRadius: 30, background: '#05060a' }} />
      </div>
    </div>
  )
}

/** Chapter pill, then the current cue's title and line, swapping with a short slide as cues change. */
function Caption({ chapter, index, total, cues }: { chapter: string; index: number; total: number; cues: Manifest['scenes'][number]['cues'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const current = cues.reduce((at, c, i) => (c.at <= frame ? i : at), 0)
  const cue = cues[current]
  const since = frame - (current === 0 ? 0 : cue.at)
  const pill = spring({ frame, fps, config: { damping: 20, stiffness: 140 } })
  const t = spring({ frame: since, fps, config: { damping: 20, stiffness: 150 } })
  const s = spring({ frame: since - 5, fps, config: { damping: 20, stiffness: 150 } })
  if (!cue) return null
  return (
    <div style={{ position: 'absolute', top: 92, left: 70, right: 70 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 20px',
          borderRadius: 999,
          background: BRAND_SOFT,
          border: `2px solid rgba(79,70,229,0.25)`,
          color: BRAND_INK,
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: 1,
          textTransform: 'uppercase',
          opacity: pill,
          transform: `translateY(${(1 - pill) * 16}px)`,
        }}
      >
        <span style={{ color: BRAND, fontWeight: 700 }}>
          {index + 1}/{total}
        </span>
        {chapter}
      </div>
      <div
        style={{
          marginTop: 20,
          color: INK,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 62,
          lineHeight: 1.05,
          letterSpacing: -1.5,
          opacity: t,
          transform: `translateY(${(1 - t) * 26}px)`,
        }}
      >
        {cue.title}
      </div>
      <div
        style={{
          marginTop: 12,
          color: INK_MUTED,
          fontFamily: sans,
          fontWeight: 500,
          fontSize: 32,
          lineHeight: 1.3,
          opacity: s,
          transform: `translateY(${(1 - s) * 20}px)`,
        }}
      >
        {cue.sub}
      </div>
    </div>
  )
}

function Intro() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 110 } })
  const name = spring({ frame: frame - 8, fps, config: { damping: 18 } })
  const line1 = spring({ frame: frame - 22, fps, config: { damping: 20 } })
  const line2 = spring({ frame: frame - 34, fps, config: { damping: 20 } })
  const exit = interpolate(frame, [INTRO - 14, INTRO], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - exit, transform: `translateY(${-exit * 60}px)` }}>
      <Img src={staticFile('logo.png')} style={{ width: 230, height: 230, borderRadius: 56, transform: `scale(${logo})`, boxShadow: '0 30px 70px rgba(79,70,229,0.28)' }} />
      <div style={{ marginTop: 46, color: INK, fontFamily: display, fontWeight: 800, fontSize: 118, letterSpacing: -3.5, opacity: name, transform: `translateY(${(1 - name) * 40}px)` }}>
        Spendiary
      </div>
      <div style={{ marginTop: 26, textAlign: 'center', fontFamily: display, fontWeight: 800, fontSize: 60, lineHeight: 1.12, letterSpacing: -1.2 }}>
        <div style={{ color: INK, opacity: line1, transform: `translateY(${(1 - line1) * 24}px)` }}>Your money, mapped.</div>
        <div style={{ color: BRAND, opacity: line2, transform: `translateY(${(1 - line2) * 24}px)` }}>On your device.</div>
      </div>
    </AbsoluteFill>
  )
}

function Outro() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: 'clamp' })
  const a = spring({ frame: frame - 6, fps, config: { damping: 14 } })
  const b = spring({ frame: frame - 16, fps, config: { damping: 18 } })
  const c = spring({ frame: frame - 30, fps, config: { damping: 14 } })
  const pulse = 1 + Math.sin(Math.max(0, frame - 45) / 7) * 0.02
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: enter }}>
      <AbsoluteFill style={{ background: `linear-gradient(175deg, ${CANVAS} 0%, #eef0ff 55%, #e7f6ef 100%)` }} />
      <Img src={staticFile('logo.png')} style={{ width: 190, height: 190, borderRadius: 46, transform: `scale(${a})`, boxShadow: '0 26px 60px rgba(79,70,229,0.25)' }} />
      <div
        style={{
          marginTop: 50,
          color: INK,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 1.05,
          letterSpacing: -2.5,
          textAlign: 'center',
          opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`,
        }}
      >
        Start tracking
        <br />
        today
      </div>
      <div style={{ marginTop: 26, color: INK_MUTED, fontFamily: sans, fontWeight: 500, fontSize: 40, opacity: b }}>Your money, mapped. On your device.</div>
      <div
        style={{
          marginTop: 70,
          padding: '28px 58px',
          borderRadius: 999,
          background: BRAND,
          color: '#fff',
          fontFamily: display,
          fontWeight: 800,
          fontSize: 50,
          letterSpacing: -0.5,
          transform: `scale(${c * pulse})`,
          boxShadow: '0 20px 50px rgba(79,70,229,0.35)',
        }}
      >
        myspendiary.vercel.app
      </div>
    </AbsoluteFill>
  )
}

/** Music under the whole video, plus a sound for every chapter change, tap, key, toggle and save. */
function Soundtrack({ manifest, starts, end, total }: { manifest: Manifest; starts: number[]; end: number; total: number }) {
  const { fps } = useVideoConfig()
  const dropAt = starts[manifest.scenes.findIndex((s) => s.id === MUSIC_ON)] ?? SCENES
  // Start the track early enough that its drop lands on that chapter (never before the song's own start)
  const offset = Math.max(0, Math.round(MUSIC_DROP_S * fps) - dropAt)
  const fadeOut = Math.round(2.5 * fps)
  const sfx = (file: string, at: number, volume: number, key: string) => (
    <Sequence key={key} from={at} durationInFrames={Math.round(2.7 * fps)} layout="none">
      <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
    </Sequence>
  )
  let keyVariant = 0
  return (
    <>
      <Audio
        src={staticFile(MUSIC)}
        startFrom={offset}
        volume={(f) =>
          MUSIC_VOLUME *
          interpolate(f, [0, Math.round(1.2 * fps), total - fadeOut, total - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        }
      />
      {sfx('chime', 4, SFX_VOLUME.chime, 'chime-in')}
      {starts.map((s, i) => sfx('whoosh', Math.max(0, s - 6), SFX_VOLUME.whoosh, `whoosh-${i}`))}
      {sfx('whoosh', end - FADE - 6, SFX_VOLUME.whoosh, 'whoosh-out')}
      {sfx('chime', end - FADE + 8, SFX_VOLUME.chime, 'chime-out')}
      {manifest.scenes.flatMap((scene, i) =>
        (scene.sounds ?? []).map((e, j) => {
          const file = e.kind === 'key' ? `key${(keyVariant++ % 3) + 1}` : e.kind
          return sfx(file, starts[i] + e.at, SFX_VOLUME[e.kind], `${scene.id}-${j}`)
        }),
      )}
    </>
  )
}

export function SpendiaryIntro({ manifest, withAudio }: IntroProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!manifest) return null
  const screenH = Math.round(SCREEN_W * (manifest.height / manifest.width))
  const total = manifest.scenes.length
  const starts = manifest.scenes.map((_, i) => SCENES + manifest.scenes.slice(0, i).reduce((s, c) => s + c.frames, 0))
  const end = SCENES + manifest.scenes.reduce((s, c) => s + c.frames, 0)
  // The phone rises in as the title card leaves and stays put; scenes swap inside it
  const rise = spring({ frame: frame - SCENES, fps, config: { damping: 18, stiffness: 90 } })

  return (
    <AbsoluteFill style={{ backgroundColor: CANVAS }}>
      <Background />
      <Sequence durationInFrames={INTRO}>
        <Intro />
      </Sequence>

      <Sequence from={SCENES} durationInFrames={end - SCENES}>
        <div style={{ position: 'absolute', left: '50%', top: 420, transform: `translateX(-50%) translateY(${(1 - rise) * 900}px)` }}>
          <Phone screenH={screenH}>
            {manifest.scenes.map((s, i) => (
              <Sequence key={s.id} from={starts[i] - SCENES} durationInFrames={s.frames} layout="none">
                <OffthreadVideo src={staticFile(s.file)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              </Sequence>
            ))}
          </Phone>
        </div>
      </Sequence>

      {manifest.scenes.map((s, i) => (
        <Sequence key={s.id} from={starts[i]} durationInFrames={s.frames}>
          <Caption chapter={s.chapter} index={i} total={total} cues={s.cues} />
        </Sequence>
      ))}

      {/* Chapter progress along the top */}
      <Sequence from={SCENES} durationInFrames={end - SCENES}>
        <Progress starts={starts.map((x) => x - SCENES)} />
      </Sequence>

      <Sequence from={end - FADE} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>

      {withAudio && <Soundtrack manifest={manifest} starts={starts} end={end} total={end - FADE + OUTRO} />}
    </AbsoluteFill>
  )
}

function Progress({ starts }: { starts: number[] }) {
  const frame = useCurrentFrame()
  const current = starts.reduce((at, s, i) => (s <= frame ? i : at), 0)
  return (
    <div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
      {starts.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 44 : 14,
            height: 12,
            borderRadius: 999,
            background: i <= current ? BRAND : 'rgba(79,70,229,0.22)',
          }}
        />
      ))}
    </div>
  )
}
