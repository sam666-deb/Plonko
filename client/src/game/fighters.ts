import type { RapierRigidBody } from '@react-three/rapier'
import type { Group } from 'three'
import type { FighterId } from './store'

// emote: 0 for none, otherwise an index into EMOTES plus one.
export type Intent = { x: number; z: number; dash: boolean; block: boolean; jump: boolean; emote: number }

export type PowerKind = 'heavy' | 'quick' | 'shock'

export type FighterHandle = {
  // Always the fighter's current physics body. The engine can replace the body while the fighter
  // lives on, so this is looked up on every use and never stored. null while it is being replaced.
  readonly body: RapierRigidBody | null
  // Remote players are proxies: hitting one sends the hit to its owner instead of moving it here.
  remote: boolean
  // Multiplier on the knockback this fighter deals.
  hitPower: () => number
  heading: () => [number, number]
  velocity: () => [number, number]
  isDashing: () => boolean
  isBlocking: () => boolean
  // The emote being played: 0 for none, otherwise an index into EMOTES plus one.
  emote: () => number
  // Damage taken this round, in per cent. The higher it is, the further a hit sends the fighter.
  damage: () => number
  // Seconds left on each timed power-up; 0 when it is not active.
  powers: () => { heavy: number; quick: number }
  // Gives the fighter a power-up it picked up. Does nothing on a proxy.
  grant: (kind: PowerKind) => void
  // A dash landed on this fighter: add the velocity change, pop it upward and stun it. Returns true
  // if the fighter blocked it instead. A proxy always returns false: its owner decides, and sends
  // the recoil back if it blocked.
  takeHit: (dvx: number, dvz: number, up: number) => boolean
  // Thrown back and briefly stunned after hitting a block.
  recoil: (dvx: number, dvz: number) => void
  // The other half of a body-to-body bump. Does nothing on a proxy, whose owner works out its own half.
  push: (dvx: number, dvz: number) => void
}

// Every live fighter, so dash hits, the bot and the network layer can find the others.
export const fighters = new Map<FighterId, FighterHandle>()

// Squash on impact, stretch along the facing direction while dashing.
export function poseFighter(g: Group, headingX: number, headingZ: number, squash: number, dashing: boolean) {
  const stretch = dashing ? 0.1 : 0
  g.rotation.y = Math.atan2(headingX, headingZ)
  g.scale.set(1 + 0.3 * squash - stretch * 0.4, 1 - 0.35 * squash - stretch * 0.2, 1 + 0.3 * squash + stretch)
}
