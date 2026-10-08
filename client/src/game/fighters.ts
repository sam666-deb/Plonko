import type { RapierRigidBody } from '@react-three/rapier'
import type { FighterId } from './store'

export type Intent = { x: number; z: number; dash: boolean }

export type FighterHandle = {
  body: RapierRigidBody
  isDashing: () => boolean
  takeHit: (dirX: number, dirZ: number, power: number) => void
}

// Every live fighter, so dash hits and the bot can find the others.
export const fighters = new Map<FighterId, FighterHandle>()
