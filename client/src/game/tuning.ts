import { useControls } from 'leva'

// Capsule dimensions are fixed; everything else is tunable live from the leva panel.
export const CAPSULE_HALF_HEIGHT = 0.4
export const CAPSULE_RADIUS = 0.4
export const REST_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS

const defaults = {
  arenaRadius: 7,
  gravity: 28,
  killY: -6,

  moveSpeed: 6.5,
  accel: 55,
  decel: 30,
  airControl: 0.35,

  dashSpeed: 17,
  dashDuration: 0.16,
  dashCooldown: 0.9,

  hitRange: 1.05,
  knockback: 13,
  knockUp: 4.5,
  hitStun: 0.38,
  stunDrag: 1.6,

  hitstopMs: 70,
  shake: 0.45,

  botSpeed: 0.55,
  botDashRange: 2.4,
  botAggression: 1.2,
  botPower: 0.65,
}

export type Tuning = typeof defaults

// Mutable copy read by the physics step, so tuning changes apply without re-rendering fighters.
export const tuning: Tuning = { ...defaults }

export function useTuning(): Tuning {
  const arena = useControls('Arena', {
    arenaRadius: { value: defaults.arenaRadius, min: 3, max: 14, step: 0.5 },
    gravity: { value: defaults.gravity, min: 5, max: 60, step: 1 },
    killY: { value: defaults.killY, min: -20, max: -2, step: 1 },
  })
  const move = useControls('Movement', {
    moveSpeed: { value: defaults.moveSpeed, min: 1, max: 15, step: 0.5 },
    accel: { value: defaults.accel, min: 5, max: 150, step: 5 },
    decel: { value: defaults.decel, min: 5, max: 150, step: 5 },
    airControl: { value: defaults.airControl, min: 0, max: 1, step: 0.05 },
  })
  const dash = useControls('Dash', {
    dashSpeed: { value: defaults.dashSpeed, min: 5, max: 40, step: 1 },
    dashDuration: { value: defaults.dashDuration, min: 0.05, max: 0.5, step: 0.01 },
    dashCooldown: { value: defaults.dashCooldown, min: 0.1, max: 3, step: 0.1 },
  })
  const hit = useControls('Hit', {
    hitRange: { value: defaults.hitRange, min: 0.8, max: 2, step: 0.05 },
    knockback: { value: defaults.knockback, min: 2, max: 40, step: 1 },
    knockUp: { value: defaults.knockUp, min: 0, max: 15, step: 0.5 },
    hitStun: { value: defaults.hitStun, min: 0, max: 1.5, step: 0.02 },
    stunDrag: { value: defaults.stunDrag, min: 0, max: 8, step: 0.2 },
    hitstopMs: { value: defaults.hitstopMs, min: 0, max: 250, step: 10 },
    shake: { value: defaults.shake, min: 0, max: 2, step: 0.05 },
  })
  const bot = useControls('Bot', {
    botSpeed: { value: defaults.botSpeed, min: 0, max: 1, step: 0.05 },
    botDashRange: { value: defaults.botDashRange, min: 1, max: 8, step: 0.2 },
    botAggression: { value: defaults.botAggression, min: 0, max: 10, step: 0.1 },
    botPower: { value: defaults.botPower, min: 0.1, max: 1.5, step: 0.05 },
  })
  return Object.assign(tuning, arena, move, dash, hit, bot)
}
