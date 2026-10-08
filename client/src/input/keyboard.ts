import type { Intent } from '../game/fighters'
import { sideOf, useGame } from '../game/store'

const held = new Set<string>()
let dashQueued = false
let jumpQueued = false
let emoteQueued = 0

window.addEventListener('keydown', (e) => {
  // Typing in a text box (the name field) is not game input.
  if (e.target instanceof HTMLInputElement) return
  if (e.code === 'Space' && !useGame.getState().menuOpen) {
    e.preventDefault()
    // A clicked HUD button keeps focus, and Space would press it again instead of dashing.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
    if (!e.repeat) dashQueued = true
  }
  if ((e.code === 'KeyE' || e.code === 'KeyJ') && !e.repeat) jumpQueued = true
  // Keys 1 to 3 play an emote.
  if (/^Digit[1-3]$/.test(e.code) && !e.repeat) emoteQueued = Number(e.code[5])
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
  const jump = jumpQueued
  const emote = emoteQueued
  dashQueued = false
  jumpQueued = false
  emoteQueued = 0
  const side = sideOf(useGame.getState().slot)
  return {
    x: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) * side,
    z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * side,
    dash,
    block: held.has('ShiftLeft') || held.has('ShiftRight'),
    jump,
    emote,
  }
}
