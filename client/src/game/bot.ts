import type { RapierRigidBody } from '@react-three/rapier'
import { fighters } from './fighters'
import type { Intent } from './fighters'
import { tuning } from './tuning'

const STEP = 1 / 60

// Walks at the player, dashes when close, and backs off the edge when it gets too near it.
export function botIntent(self: RapierRigidBody): Intent {
  const me = self.translation()
  const target = fighters.get('me')?.body.translation()

  let x = -me.x
  let z = -me.z
  let dash = false

  const nearEdge = Math.hypot(me.x, me.z) > tuning.arenaRadius * 0.75
  if (target && target.y > 0 && !nearEdge) {
    x = target.x - me.x
    z = target.z - me.z
    const dist = Math.hypot(x, z)
    dash = dist < tuning.botDashRange && Math.random() < tuning.botAggression * STEP
  }

  const len = Math.hypot(x, z)
  if (len < 0.3) return { x: 0, z: 0, dash: false }
  return { x: (x / len) * tuning.botSpeed, z: (z / len) * tuning.botSpeed, dash }
}
