import { staticFile, type CalculateMetadataFunction } from 'remotion'

// Kept out of Intro.tsx so that file exports only components (React Fast Refresh)

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

export const INTRO = 105
export const OUTRO = 150
/** The first scene starts this long before the title card ends, and the end card overlaps the last scene by as much. */
export const FADE = 15
/** Where the first scene starts. */
export const SCENES = INTRO - FADE

export const calculateIntroMetadata: CalculateMetadataFunction<IntroProps> = async ({ props }) => {
  const manifest: Manifest = await fetch(staticFile('clips/manifest.json')).then((r) => r.json())
  const scenes = manifest.scenes.reduce((s, c) => s + c.frames, 0)
  return { props: { ...props, manifest }, durationInFrames: SCENES + scenes + OUTRO - FADE }
}
