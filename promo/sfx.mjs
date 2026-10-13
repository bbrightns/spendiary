// Synthesizes the walkthrough's UI sound effects into public/sfx/*.wav (48 kHz mono).
// Plain math, no samples: nothing to license, and every run gives the same files.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('./public/sfx/', import.meta.url))
const RATE = 48000
mkdirSync(OUT, { recursive: true })

/** Deterministic noise, so re-runs produce identical files. */
function noise(seed = 1) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s / 2 ** 32) * 2 - 1
  }
}

function wav(name, samples) {
  const peak = Math.max(1e-9, ...samples.map(Math.abs))
  const gain = peak > 0.98 ? 0.98 / peak : 1
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2))
  writeFileSync(`${OUT}${name}.wav`, buf)
  console.log('wrote', name, `${(samples.length / RATE).toFixed(2)}s`)
}

const render = (seconds, fn) => Array.from({ length: Math.round(seconds * RATE) }, (_, i) => fn(i / RATE))
const TAU = Math.PI * 2

/** Bell-ish tone: sine plus a soft octave, exponential decay, 3 ms attack so it doesn't click. */
const bell = (t, f, decay) => (t < 0 ? 0 : Math.min(1, t / 0.003) * Math.exp(-t / decay) * (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)))

// Tap: a short, rounded "tock" that drops in pitch
{
  let phase = 0
  wav(
    'tap',
    render(0.09, (t) => {
      const f = 520 + 700 * Math.exp(-t / 0.012)
      phase += (TAU * f) / RATE
      return Math.min(1, t / 0.0015) * Math.exp(-t / 0.022) * Math.sin(phase) * 0.9
    }),
  )
}

// Keys: soft plastic ticks, three variants so typing doesn't sound like a machine gun
for (const [i, pitch] of [
  [1, 1],
  [2, 1.12],
  [3, 0.9],
]) {
  const n = noise(i * 97)
  let lp = 0
  wav(
    `key${i}`,
    render(0.05, (t) => {
      lp += 0.35 * (n() - lp)
      const click = (n() - lp) * Math.exp(-t / 0.004) * 0.6
      const body = Math.sin(TAU * 260 * pitch * t) * Math.exp(-t / 0.012) * 0.45
      return (click + body) * Math.min(1, t / 0.0008)
    }),
  )
}

// Toggle: two quick rising blips
wav(
  'toggle',
  render(0.22, (t) => 0.5 * bell(t, 880, 0.035) + 0.5 * bell(t - 0.07, 1320, 0.05)),
)

// Success: a light three-note rise (C6 E6 G6)
wav(
  'success',
  render(0.9, (t) => 0.38 * (bell(t, 1046.5, 0.18) + bell(t - 0.075, 1318.5, 0.22) + bell(t - 0.15, 1568, 0.32))),
)

// Whoosh: noise through a lowpass that sweeps up then down, for chapter changes
{
  const n = noise(7)
  let lp1 = 0
  let lp2 = 0
  const len = 0.55
  wav(
    'whoosh',
    render(len, (t) => {
      const x = t / len
      const cutoff = 300 + 5200 * Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 2
      const a = 1 - Math.exp((-TAU * cutoff) / RATE)
      lp1 += a * (n() - lp1)
      lp2 += a * (lp1 - lp2)
      return lp2 * Math.sin(Math.PI * x) ** 1.6 * 1.6
    }),
  )
}

// Chime: a soft arpeggiated C major chord with a long tail, for the title and end cards
wav(
  'chime',
  render(2.6, (t) =>
    0.22 * (bell(t, 523.25, 0.9) + bell(t - 0.06, 659.25, 0.9) + bell(t - 0.12, 783.99, 1) + bell(t - 0.18, 1046.5, 1.1) + 0.5 * bell(t - 0.24, 1568, 0.8)),
  ),
)
