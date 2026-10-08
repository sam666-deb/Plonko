import type { RapierRigidBody } from '@react-three/rapier'
import type { Tier } from '@plonko/shared'
import { fighters } from './fighters'
import type { Intent } from './fighters'
import { TILE, isSafe, refuge, routeStep } from './floor'
import { itemsOnFloor } from './powerups'
import { currentStage } from './store'
import { tuning } from './tuning'

const STEP = 1 / 60

// How much quicker, keener and harder-hitting the bot gets on each tier, relative to the tuning panel's values.
// `block` is the chance it raises its guard when the player dashes at it.
export const BOT_TIERS: Record<Tier, { speed: number; aggression: number; power: number; block: number }> = {
  normal: { speed: 1, aggression: 1, power: 1, block: 0.1 },
  medium: { speed: 1.2, aggression: 1.5, power: 1.2, block: 0.25 },
  hard: { speed: 1.35, aggression: 2, power: 1.4, block: 0.45 },
  extreme: { speed: 1.55, aggression: 2.7, power: 1.55, block: 0.65 },
}

const BLOCK_RANGE = 4
const BLOCK_HOLD_MS = 450
let sawDash = false
let blockUntil = 0

const STILL: Intent = { x: 0, z: 0, dash: false, block: false, jump: false, emote: 0 }
// It goes for a power-up only when one is clearly closer than the player.
const ITEM_PULL = 0.7

// Walks to the player along solid floor and dashes when close and lined up. If its own footing
// is about to go, or the player cannot be reached, it retreats to the safest tile nearby.
export function botIntent(self: RapierRigidBody): Intent {
  const me = self.translation()
  const player = fighters.get('me')
  const target = player?.body?.translation()
  const tier = BOT_TIERS[currentStage().tier]
  const speed = Math.min(1, tuning.botSpeed * tier.speed)

  // React once to each dash the player starts nearby: sometimes turn to face it and block.
  const dashing = Boolean(player?.isDashing())
  let jump = false
  if (dashing && !sawDash && target && Math.hypot(target.x - me.x, target.z - me.z) < BLOCK_RANGE) {
    // Mostly it blocks; some of the time it hops over the dash instead.
    const roll = Math.random()
    if (roll < tier.block) blockUntil = performance.now() + BLOCK_HOLD_MS
    else if (roll < tier.block * 1.5) jump = true
  }
  sawDash = dashing
  if (target && performance.now() < blockUntil) {
    const dx = target.x - me.x
    const dz = target.z - me.z
    const dist = Math.hypot(dx, dz) || 1
    return { x: dx / dist, z: dz / dist, dash: false, block: true, jump: false, emote: 0 }
  }

  let goal: { x: number; z: number } | null = null
  let dash = false

  if (isSafe(me.x, me.z) && target && target.y > 0) {
    goal = routeStep(me.x, me.z, target.x, target.z)
    const dx = target.x - me.x
    const dz = target.z - me.z
    const dist = Math.hypot(dx, dz)
    // Dash only with floor to land on, and steer straight at the player while lining it up.
    if (goal && dist < tuning.botDashRange && isSafe(me.x + (dx / dist) * TILE, me.z + (dz / dist) * TILE)) {
      goal = { x: target.x, z: target.z }
      dash = Math.random() < tuning.botAggression * tier.aggression * STEP
    }
  }
  // Detour for a power-up that is clearly nearer than the player.
  if (goal && target && !dash) {
    const toPlayer = Math.hypot(target.x - me.x, target.z - me.z)
    for (const item of itemsOnFloor()) {
      if (Math.hypot(item.x - me.x, item.z - me.z) > toPlayer * ITEM_PULL) continue
      goal = routeStep(me.x, me.z, item.x, item.z) ?? goal
      break
    }
  }
  goal ??= refuge(me.x, me.z)
  if (!goal) return STILL

  const x = goal.x - me.x
  const z = goal.z - me.z
  const len = Math.hypot(x, z)
  if (len < 0.25) return STILL
  return { x: (x / len) * speed, z: (z / len) * speed, dash, block: false, jump, emote: 0 }
}
