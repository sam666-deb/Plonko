// All sound effects are synthesised with Web Audio, so there are no audio files to download.

import { useSettings } from '../game/settings'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

const outputGain = () => {
  const s = useSettings.getState()
  return s.muted ? 0 : s.volume * 0.7
}
useSettings.subscribe(() => {
  if (master) master.gain.value = outputGain()
})

// Browsers only allow audio after the player has interacted with the page.
function unlock() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = outputGain()
    master.connect(ctx.destination)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
}
window.addEventListener('keydown', unlock)
window.addEventListener('pointerdown', unlock)

// Fades a gain node from `gain` to silence over `dur` seconds and connects it to the output.
function envelope(gain: number, start: number, dur: number) {
  const g = ctx!.createGain()
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  g.connect(master!)
  return g
}

function tone(type: OscillatorType, from: number, to: number, dur: number, gain: number, delay = 0) {
  if (!ctx || !master) return
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  osc.connect(envelope(gain, start, dur))
  osc.start(start)
  osc.stop(start + dur)
}

function noise(filter: BiquadFilterType, from: number, to: number, dur: number, gain: number) {
  if (!ctx || !master) return
  const start = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(from, start)
  f.frequency.exponentialRampToValueAtTime(to, start + dur)
  src.connect(f).connect(envelope(gain, start, dur))
  src.start(start)
  src.stop(start + dur)
}

const notes = (type: OscillatorType, freqs: number[], each: number, gain: number) =>
  freqs.forEach((f, i) => tone(type, f, f, each * 1.6, gain, i * each))

export const sfx = {
  dash: (volume = 1) => noise('bandpass', 500, 2600, 0.18, 0.3 * volume),
  // strength runs from 0 (a tap) to about 1.5 (a head-on dash).
  hit: (strength: number) => {
    tone('sine', 170, 45, 0.25, 0.8 * strength)
    noise('lowpass', 2200, 250, 0.14, 0.6 * strength)
    // The ring of a weapon connecting.
    tone('triangle', 1900, 1400, 0.18, 0.18 * strength)
    tone('square', 2850, 2600, 0.09, 0.05 * strength)
  },
  bump: (strength: number) => tone('sine', 120, 60, 0.1, 0.35 * strength),
  // A floor tile breaking away. Quiet, because several can go in a second.
  crumble: () => noise('lowpass', 700, 120, 0.25, 0.22),
  fall: () => tone('triangle', 520, 80, 0.6, 0.25),
  ready: () => tone('square', 440, 440, 0.08, 0.1),
  go: () => tone('square', 880, 880, 0.2, 0.12),
  roundWon: () => notes('triangle', [523, 659, 784], 0.09, 0.25),
  roundLost: () => notes('triangle', [392, 330, 262], 0.11, 0.2),
  matchWon: () => notes('triangle', [523, 659, 784, 1047, 1319], 0.12, 0.28),
  matchLost: () => notes('sawtooth', [330, 262, 220, 165], 0.2, 0.12),
}
