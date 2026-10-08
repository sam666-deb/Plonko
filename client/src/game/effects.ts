import { sfx } from '../audio/sfx'
import { fx, useGame } from './store'

export const MAX_PARTICLES = 256
// A fighter this far below the platform top cannot get back, so the knockout is shown here
// rather than waiting for it to reach the kill height.
export const KO_Y = -1.2
const KO_FREEZE_MS = 180

export type Particle = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  color: string
}

// Fixed pool, reused in a ring: when it is full the oldest particles are replaced.
export const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 1,
  size: 0,
  color: '#ffffff',
}))
let cursor = 0

type Burst = {
  x: number
  y: number
  z: number
  count: number
  color: string
  // Random speed in every direction, plus an optional shared push along (dirX, dirZ).
  speed: number
  dirX?: number
  dirZ?: number
  push?: number
  up?: number
  life?: number
  size?: number
}

export function burst({ x, y, z, count, color, speed, dirX = 0, dirZ = 0, push = 0, up = 1, life = 0.45, size = 0.13 }: Burst) {
  for (let i = 0; i < count; i++) {
    const p = particles[cursor]
    cursor = (cursor + 1) % MAX_PARTICLES
    const angle = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random() * 0.6)
    p.x = x
    p.y = y
    p.z = z
    p.vx = Math.cos(angle) * s + dirX * push
    p.vz = Math.sin(angle) * s + dirZ * push
    p.vy = up * (0.5 + Math.random()) * 2
    p.maxLife = p.life = life * (0.6 + Math.random() * 0.4)
    p.size = size * (0.6 + Math.random() * 0.8)
    p.color = color
  }
}

// The moment a fighter drops past the edge: freeze-frame, flash, a fountain of sparks and the fall sound.
export function knockoutEffect(x: number, z: number, color: string) {
  burst({ x, y: 0.2, z, count: 40, color, speed: 5, up: 4.5, life: 0.9, size: 0.2 })
  burst({ x, y: 0.2, z, count: 16, color: '#ffffff', speed: 7, up: 3, life: 0.6 })
  fx.shake = 0.9
  sfx.fall()
  const g = useGame.getState()
  useGame.setState({ flashes: g.flashes + 1 })
  g.hitstop(KO_FREEZE_MS)
}
