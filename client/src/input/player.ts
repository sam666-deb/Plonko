import type { Intent } from '../game/fighters'
import { keyboardIntent } from './keyboard'
import { touchIntent } from './touch'

// The local player's input: keyboard and on-screen controls together, so either works at any time.
export function playerIntent(): Intent {
  const k = keyboardIntent()
  const t = touchIntent()
  return {
    x: Math.max(-1, Math.min(1, k.x + t.x)),
    z: Math.max(-1, Math.min(1, k.z + t.z)),
    dash: k.dash || t.dash,
    block: k.block || t.block,
    jump: k.jump || t.jump,
    emote: k.emote || t.emote,
  }
}
