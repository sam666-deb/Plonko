import type { Tier } from '@plonko/shared'
import { useSettings } from '../game/settings'
import { every } from '../game/ticker'
import { audioContext } from './sfx'

// Background music, synthesised like the sound effects: a 16-step loop of bass, a lead line and
// drums for each tier, faster and busier as the tiers climb. Nothing is downloaded.

export type Track = Tier | 'menu'

type Pattern = {
  bpm: number
  // Frequency of the scale's root, and the scale as semitones above it.
  root: number
  scale: number[]
  // One entry per sixteenth note: a scale degree to play, or null for a rest.
  bass: (number | null)[]
  lead: (number | null)[]
  // 'k' kick, 'h' hat, 'x' both, '.' nothing.
  drums: string
}

const MINOR = [0, 2, 3, 5, 7, 8, 10]
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]
const _ = null

const PATTERNS: Record<Track, Pattern> = {
  menu: {
    bpm: 84,
    root: 110,
    scale: MINOR,
    bass: [0, _, _, _, _, _, _, _, 5, _, _, _, _, _, _, _],
    lead: [7, _, 9, _, 11, _, 9, _, 7, _, 9, _, 12, _, 11, _],
    drums: '....h.......h...',
  },
  normal: {
    bpm: 104,
    root: 110,
    scale: MINOR,
    bass: [0, _, _, 0, _, _, 4, _, 5, _, _, 5, _, _, 4, _],
    lead: [7, _, 9, _, 11, _, 9, _, 7, _, 11, _, 12, _, 9, _],
    drums: 'k...h...k...h.h.',
  },
  medium: {
    bpm: 116,
    root: 123.47,
    scale: MINOR,
    bass: [0, _, 0, _, 3, _, 3, _, 5, _, 5, _, 4, _, 4, _],
    lead: [7, 9, _, 11, _, 9, 7, _, 12, _, 11, 9, _, 11, 14, _],
    drums: 'k.h.h.h.k.h.h.hh',
  },
  hard: {
    bpm: 128,
    root: 146.83,
    scale: MINOR,
    bass: [0, 0, _, 0, 0, _, 3, 3, 5, 5, _, 5, 4, _, 4, 4],
    lead: [14, _, 11, 12, _, 9, 11, _, 14, _, 12, 11, 9, _, 7, 9],
    drums: 'k.h.x.h.k.hkx.hh',
  },
  extreme: {
    bpm: 144,
    root: 164.81,
    scale: PHRYGIAN,
    bass: [0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 5, 0, 4, 3, 1, 0],
    lead: [14, 15, 14, 11, 12, _, 14, 15, 17, 15, 14, 12, 11, 12, 14, _],
    drums: 'k.hkx.hkk.hkx.xh',
  },
}

const degreeToHz = (p: Pattern, degree: number) => {
  const octave = Math.floor(degree / p.scale.length)
  return p.root * 2 ** (octave + p.scale[degree % p.scale.length] / 12)
}

let gain: GainNode | null = null
let noise: AudioBuffer | null = null
let track: Track = 'menu'
let step = 0
let nextAt = 0

const level = () => {
  const s = useSettings.getState()
  return s.music && !s.muted ? s.musicVolume * 0.35 : 0
}
useSettings.subscribe(() => {
  if (gain) gain.gain.value = level()
})

function voice(ctx: AudioContext, type: OscillatorType, hz: number, at: number, length: number, volume: number, cutoff: number) {
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  osc.type = type
  osc.frequency.value = hz
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  env.gain.setValueAtTime(volume, at)
  env.gain.exponentialRampToValueAtTime(0.001, at + length)
  osc.connect(filter).connect(env).connect(gain!)
  osc.start(at)
  osc.stop(at + length)
}

function kick(ctx: AudioContext, at: number) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.frequency.setValueAtTime(130, at)
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.12)
  env.gain.setValueAtTime(0.9, at)
  env.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
  osc.connect(env).connect(gain!)
  osc.start(at)
  osc.stop(at + 0.16)
}

function hat(ctx: AudioContext, at: number) {
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  src.buffer = noise
  filter.type = 'highpass'
  filter.frequency.value = 7000
  env.gain.setValueAtTime(0.25, at)
  env.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
  src.connect(filter).connect(env).connect(gain!)
  src.start(at)
  src.stop(at + 0.05)
}

// Queues every step due in the next moment. Notes are placed on the audio clock, so the beat
// stays even however unevenly this function gets called.
function schedule() {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return
  if (!gain) {
    gain = ctx.createGain()
    gain.gain.value = level()
    gain.connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate / 4, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (level() === 0) {
    nextAt = 0
    return
  }
  if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05

  while (nextAt < ctx.currentTime + 0.2) {
    const p = PATTERNS[track]
    const sixteenth = 60 / p.bpm / 4
    const i = step % 16
    const bass = p.bass[i]
    const lead = p.lead[i]
    if (bass !== null) voice(ctx, 'sawtooth', degreeToHz(p, bass) / 2, nextAt, sixteenth * 1.8, 0.5, 500)
    if (lead !== null) voice(ctx, 'square', degreeToHz(p, lead), nextAt, sixteenth * 1.4, 0.13, 2400)
    const drum = p.drums[i]
    if (drum === 'k' || drum === 'x') kick(ctx, nextAt)
    if (drum === 'h' || drum === 'x') hat(ctx, nextAt)
    step++
    nextAt += sixteenth
  }
}

// Which loop to play. A change takes effect on the next step, keeping the beat.
export function setTrack(next: Track) {
  track = next
}

every(50, schedule)
