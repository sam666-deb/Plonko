import type { Intent } from '../game/fighters'
import { sideOf, useGame } from '../game/store'

// What the on-screen controls are doing. Written by TouchControls, read once per physics step.
export const touch = {
  // The stick's deflection in screen terms: x right, y up, each from -1 to 1.
  stickX: 0,
  stickY: 0,
  block: false,
  dash: false,
  jump: false,
  emote: 0,
}

// Screen-up is away from the camera, which is world -Z for the first player and +Z for the
// second, whose view is from the far side.
export function touchIntent(): Intent {
  const side = sideOf(useGame.getState().slot)
  const intent = { x: touch.stickX * side, z: -touch.stickY * side, dash: touch.dash, block: touch.block, jump: touch.jump, emote: touch.emote }
  touch.dash = false
  touch.jump = false
  touch.emote = 0
  return intent
}
