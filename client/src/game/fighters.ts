import type { RapierRigidBody } from '@react-three/rapier'
import type { Group } from 'three'
import type { FighterId } from './store'

export type Intent = { x: number; z: number; dash: boolean }

export type FighterHandle = {
  body: RapierRigidBody
  // Remote players are proxies: hitting one sends the hit to its owner instead of moving it here.
  remote: boolean
  // Multiplier on the knockback this fighter deals.
  hitPower: () => number
  heading: () => [number, number]
  isDashing: () => boolean
  takeHit: (dirX: number, dirZ: number, power: number) => void
}

// Every live fighter, so dash hits, the bot and the network layer can find the others.
export const fighters = new Map<FighterId, FighterHandle>()

// Squash on impact, stretch along the facing direction while dashing.
export function poseFighter(g: Group, headingX: number, headingZ: number, squash: number, dashing: boolean) {
  const stretch = dashing ? 0.25 : 0
  g.rotation.y = Math.atan2(headingX, headingZ)
  g.scale.set(1 + 0.3 * squash - stretch * 0.4, 1 - 0.35 * squash - stretch * 0.2, 1 + 0.3 * squash + stretch)
}
