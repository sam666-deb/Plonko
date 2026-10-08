import type { Hazard } from '@plonko/shared'
import { FALLEN, TILE, floor } from './floor'
import { currentStage, useGame } from './store'
import { CAPSULE_RADIUS, REST_Y } from './tuning'

// Stage hazards. Everything here is worked out from the round clock, so both players see the
// same sweeper angle and the same spikes without anything being sent. Each client applies a
// hazard only to the fighters it simulates.

export const SWEEPER_HALF_WIDTH = 0.18
export const BUMPER_RADIUS = 0.5
// Spikes peek out for the warning, then stand fully up while live.
const SPIKE_WARN_S = 0.8
const SPIKE_LIVE_S = 0.7
// A fighter this far off the ground clears the sweeper.
const SWEEPER_CLEARANCE = 0.5
const STRIKE_COOLDOWN_MS = 350

// Seconds since fighters were released this round, for drawing. Never negative.
export const hazardClock = () => Math.max(0, (performance.now() - useGame.getState().playAt) / 1000)

// Whether hazards can hurt right now: only in a live round against an opponent.
function live() {
  const g = useGame.getState()
  if (g.banner || g.match || performance.now() < g.playAt) return false
  return g.mode === 'solo' || g.peers.length > 0
}

export const sweeperAngle = (h: Extract<Hazard, { type: 'sweeper' }>, t: number) => (t / h.period) * Math.PI * 2

// How far up the spikes are (0 to 1) and whether they hurt, at time t.
export function spikeState(h: Extract<Hazard, { type: 'spikes' }>, t: number) {
  const left = h.period - (t % h.period)
  if (left <= SPIKE_LIVE_S) return { height: 1, live: true }
  if (left <= SPIKE_LIVE_S + SPIKE_WARN_S) return { height: 0.25, live: false }
  return { height: 0, live: false }
}

// Whether the tile under a point is still there. Hazards standing on a tile go when it falls.
export function tileStands(i: number, j: number) {
  const n = floor.index.get(`${i},${j}`)
  return n !== undefined && floor.phase[n] !== FALLEN
}

export type Strike = { vx: number; vz: number; up: number; stun: number; damage: number; kind: Hazard['type'] }

const lastStrike = new Map<string, number>()

// What, if anything, hits a fighter at position p moving at v. The result replaces its velocity.
export function hazardStrike(id: string, p: { x: number; y: number; z: number }, v: { x: number; z: number }): Strike | null {
  if (!live()) return null
  const now = performance.now()
  if (now - (lastStrike.get(id) ?? 0) < STRIKE_COOLDOWN_MS) return null
  const t = hazardClock()
  const height = p.y - REST_Y

  for (const h of currentStage().hazards) {
    let strike: Strike | null = null

    if (h.type === 'sweeper') {
      const angle = sweeperAngle(h, t)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const along = p.x * cos + p.z * sin
      const across = -p.x * sin + p.z * cos
      if (height < SWEEPER_CLEARANCE && height > -0.3 && Math.abs(along) <= h.length * TILE && Math.abs(across) < SWEEPER_HALF_WIDTH + CAPSULE_RADIUS) {
        // Carried off in the direction that part of the bar is moving, faster the further out.
        const spin = Math.sign(h.period) * Math.sign(along || 1)
        const speed = Math.max(7, Math.abs(((Math.PI * 2) / h.period) * along) * 1.3)
        strike = { vx: -sin * spin * speed, vz: cos * spin * speed, up: 3.5, stun: 0.3, damage: 8, kind: 'sweeper' }
      }
    } else if (h.type === 'spikes') {
      if (!spikeState(h, t).live || Math.abs(height) > 0.2) continue
      for (const [i, j] of h.tiles) {
        const dx = p.x - i * TILE
        const dz = p.z - j * TILE
        if (Math.abs(dx) > TILE / 2 || Math.abs(dz) > TILE / 2 || !tileStands(i, j)) continue
        // Thrown up and off the tile, away from its centre.
        const angle = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2
        strike = { vx: Math.cos(angle) * 6, vz: Math.sin(angle) * 6, up: 10, stun: 0.45, damage: 12, kind: 'spikes' }
      }
    } else {
      const [i, j] = h.at
      const dx = p.x - i * TILE
      const dz = p.z - j * TILE
      const dist = Math.hypot(dx, dz)
      if (dist < BUMPER_RADIUS + CAPSULE_RADIUS && dist > 1e-3 && height < 0.9 && height > -0.3 && tileStands(Math.round(i), Math.round(j))) {
        const speed = Math.max(9, Math.hypot(v.x, v.z) * 1.1)
        strike = { vx: (dx / dist) * speed, vz: (dz / dist) * speed, up: 2.5, stun: 0.15, damage: 5, kind: 'bumper' }
      }
    }

    if (strike) {
      lastStrike.set(id, now)
      return strike
    }
  }
  return null
}
