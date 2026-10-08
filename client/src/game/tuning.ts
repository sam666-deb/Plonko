import { useControls } from 'leva'

// Capsule dimensions are fixed; everything else is tunable live from the leva panel.
export const CAPSULE_HALF_HEIGHT = 0.4
export const CAPSULE_RADIUS = 0.4
export const REST_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS

const defaults = {
  gravity: 28,
  killY: -6,

  moveSpeed: 6.5,
  accel: 40,
  decel: 24,
  airControl: 0.35,

  jumpSpeed: 9.5,

  dashSpeed: 12,
  dashDuration: 0.2,
  dashCooldown: 0.9,

  // Fighters have equal mass. restitution is how bouncy a collision is (0 = they stick, 1 = full bounce).
  restitution: 0.7,
  separation: 10,
  bumpStagger: 0.05,

  hitRange: 1.05,
  dashImpact: 1.3,
  knockUp: 4.5,
  hitStun: 0.38,
  stunDrag: 1.6,

  // Blocking: the share of a hit's knockback that still gets through, and the share thrown back at the attacker.
  blockKnock: 0.15,
  blockRecoil: 0.6,
  // Seconds a full guard can be held, seconds to refill it from empty, and the share each blocked hit costs.
  guardTime: 1.2,
  guardRecharge: 2.2,
  guardCost: 0.35,

  // Damage: each hit taken adds hitDamage per cent, and at 100 per cent knockback is (1 + damageScale) times as strong.
  hitDamage: 18,
  damageScale: 1,

  hitstopMs: 70,
  shake: 0.45,

  botSpeed: 0.55,
  botDashRange: 2.4,
  botAggression: 1.2,
  botPower: 0.65,

  interpDelayMs: 100,
  simLatencyMs: 0,
  simJitterMs: 0,
  simLossPct: 0,
}

export type Tuning = typeof defaults

// Mutable copy read by the physics step, so tuning changes apply without re-rendering fighters.
export const tuning: Tuning = { ...defaults }

export function useTuning(): Tuning {
  const world = useControls('World', {
    gravity: { value: defaults.gravity, min: 5, max: 60, step: 1 },
    killY: { value: defaults.killY, min: -20, max: -2, step: 1 },
  })
  const move = useControls('Movement', {
    moveSpeed: { value: defaults.moveSpeed, min: 1, max: 15, step: 0.5 },
    accel: { value: defaults.accel, min: 5, max: 150, step: 5 },
    decel: { value: defaults.decel, min: 5, max: 150, step: 5 },
    airControl: { value: defaults.airControl, min: 0, max: 1, step: 0.05 },
    jumpSpeed: { value: defaults.jumpSpeed, min: 4, max: 16, step: 0.5 },
  })
  const dash = useControls('Dash', {
    dashSpeed: { value: defaults.dashSpeed, min: 5, max: 40, step: 1 },
    dashDuration: { value: defaults.dashDuration, min: 0.05, max: 0.5, step: 0.01 },
    dashCooldown: { value: defaults.dashCooldown, min: 0.1, max: 3, step: 0.1 },
  })
  const body = useControls('Body', {
    restitution: { value: defaults.restitution, min: 0, max: 1, step: 0.05 },
    separation: { value: defaults.separation, min: 0, max: 30, step: 1 },
    bumpStagger: { value: defaults.bumpStagger, min: 0, max: 0.2, step: 0.01 },
  })
  const hit = useControls('Hit', {
    hitRange: { value: defaults.hitRange, min: 0.8, max: 2, step: 0.05 },
    dashImpact: { value: defaults.dashImpact, min: 0.5, max: 3, step: 0.05 },
    knockUp: { value: defaults.knockUp, min: 0, max: 15, step: 0.5 },
    hitStun: { value: defaults.hitStun, min: 0, max: 1.5, step: 0.02 },
    stunDrag: { value: defaults.stunDrag, min: 0, max: 8, step: 0.2 },
    hitstopMs: { value: defaults.hitstopMs, min: 0, max: 250, step: 10 },
    shake: { value: defaults.shake, min: 0, max: 2, step: 0.05 },
  })
  const block = useControls('Block', {
    hitDamage: { value: defaults.hitDamage, min: 0, max: 60, step: 1 },
    damageScale: { value: defaults.damageScale, min: 0, max: 3, step: 0.1 },
    blockKnock: { value: defaults.blockKnock, min: 0, max: 1, step: 0.05 },
    blockRecoil: { value: defaults.blockRecoil, min: 0, max: 1.5, step: 0.05 },
    guardTime: { value: defaults.guardTime, min: 0.3, max: 5, step: 0.1 },
    guardRecharge: { value: defaults.guardRecharge, min: 0.3, max: 6, step: 0.1 },
    guardCost: { value: defaults.guardCost, min: 0, max: 1, step: 0.05 },
  })
  const bot = useControls('Bot', {
    botSpeed: { value: defaults.botSpeed, min: 0, max: 1, step: 0.05 },
    botDashRange: { value: defaults.botDashRange, min: 1, max: 8, step: 0.2 },
    botAggression: { value: defaults.botAggression, min: 0, max: 10, step: 0.1 },
    botPower: { value: defaults.botPower, min: 0.1, max: 1.5, step: 0.05 },
  })
  const net = useControls('Network', {
    interpDelayMs: { value: defaults.interpDelayMs, min: 0, max: 400, step: 10 },
    simLatencyMs: { value: defaults.simLatencyMs, min: 0, max: 500, step: 10 },
    simJitterMs: { value: defaults.simJitterMs, min: 0, max: 200, step: 5 },
    simLossPct: { value: defaults.simLossPct, min: 0, max: 50, step: 1 },
  })
  return Object.assign(tuning, world, move, dash, body, hit, block, bot, net)
}
