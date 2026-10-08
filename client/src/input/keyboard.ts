import type { Intent } from '../game/fighters'

const held = new Set<string>()
let dashQueued = false

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault()
    if (!e.repeat) dashQueued = true
  }
  held.add(e.code)
})
window.addEventListener('keyup', (e) => held.delete(e.code))
window.addEventListener('blur', () => held.clear())

const axis = (neg: string[], pos: string[]) =>
  (pos.some((k) => held.has(k)) ? 1 : 0) - (neg.some((k) => held.has(k)) ? 1 : 0)

// The camera is fixed, so W/S map straight onto world -Z/+Z and A/D onto -X/+X.
export function keyboardIntent(): Intent {
  const dash = dashQueued
  dashQueued = false
  return {
    x: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
    z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    dash,
  }
}
