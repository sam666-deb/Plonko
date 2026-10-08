import type { Intent } from '../game/fighters'
import { sideOf, useGame } from '../game/store'

const held = new Set<string>()
let dashQueued = false

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !useGame.getState().menuOpen) {
    e.preventDefault()
    // A clicked HUD button keeps focus, and Space would press it again instead of dashing.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
    if (!e.repeat) dashQueued = true
  }
  held.add(e.code)
})
window.addEventListener('keyup', (e) => held.delete(e.code))
window.addEventListener('blur', () => held.clear())

const axis = (neg: string[], pos: string[]) =>
  (pos.some((k) => held.has(k)) ? 1 : 0) - (neg.some((k) => held.has(k)) ? 1 : 0)

// The camera is fixed, so W/S map straight onto world -Z/+Z and A/D onto -X/+X,
// reversed for the player whose view is from the far side.
export function keyboardIntent(): Intent {
  const dash = dashQueued
  dashQueued = false
  const side = sideOf(useGame.getState().slot)
  return {
    x: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) * side,
    z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * side,
    dash,
  }
}
