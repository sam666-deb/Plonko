import { TILE, FALLEN, floor } from './floor'
import type { PowerKind } from './fighters'
import { useGame } from './store'

// Power-ups: items that appear on the floor during a round. When and where each one appears is
// worked out from the round's seed, so both players see the same items without them being sent.
// Who gets one is settled by the server online, and on the spot in a solo game.

const FIRST_AT_S = 5
const EVERY_S = 7
const PICKUP_RADIUS = 0.9
const KINDS: PowerKind[] = ['heavy', 'quick', 'shock']
export const POWER_SECONDS = { heavy: 8, quick: 10 }
export const POWER_COLORS: Record<PowerKind, string> = { heavy: '#c084fc', quick: '#facc15', shock: '#22d3ee' }

export type Item = { n: number; kind: PowerKind; x: number; z: number }

// The same value on every client for a given round and item number. `salt` gives independent
// values for an item's place and its kind.
function hash(seed: number, n: number, salt: number) {
  let h = (Math.imul(seed | 0, 374761393) ^ Math.imul(n + 1, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const PLACE = 1
const KIND = 2
const kindFor = (seed: number, n: number) => KINDS[Math.floor(hash(seed, n, KIND) * KINDS.length)]

const taken = new Set<number>()
// Items this client has asked the server for and not yet heard back about.
const asked = new Set<number>()
let takenForRound = -1

function freshRound() {
  const round = useGame.getState().round
  if (round === takenForRound) return
  takenForRound = round
  taken.clear()
  asked.clear()
}

export function markTaken(n: number) {
  freshRound()
  taken.add(n)
}

// Returns true the first time an item is asked for, so the request is sent only once.
export function askOnce(n: number) {
  if (asked.has(n)) return false
  asked.add(n)
  return true
}

// The items lying on the floor right now.
export function itemsOnFloor(): Item[] {
  freshRound()
  const g = useGame.getState()
  const contested = g.mode === 'solo' || g.peers.length > 0
  const t = (performance.now() - g.playAt) / 1000
  if (!contested || t < FIRST_AT_S || floor.tiles.length === 0) return []

  const items: Item[] = []
  const count = Math.floor((t - FIRST_AT_S) / EVERY_S) + 1
  for (let n = 0; n < count; n++) {
    if (taken.has(n)) continue
    const tileIndex = Math.floor(hash(g.seed, n, PLACE) * floor.tiles.length)
    // An item goes down with its tile, and never appears on one that has already gone.
    if (floor.phase[tileIndex] === FALLEN) continue
    const tile = floor.tiles[tileIndex]
    items.push({ n, kind: kindFor(g.seed, n), x: tile.x, z: tile.z })
  }
  return items
}

// The item a fighter standing at (x, z) is touching, if any.
export function itemAt(x: number, z: number): Item | null {
  for (const item of itemsOnFloor()) if (Math.hypot(item.x - x, item.z - z) < PICKUP_RADIUS) return item
  return null
}

// The kind of item number n this round, for when the server says who got it.
export const kindOf = (n: number): PowerKind => kindFor(useGame.getState().seed, n)

export const ITEM_SIZE = TILE * 0.22
