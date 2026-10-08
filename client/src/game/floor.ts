import type { Stage } from '@plonko/shared'

// The live state of the arena floor, kept outside React so the physics step, the bot and the
// renderer all read the same thing.

// The dungeon pack is built for characters about 2.2 units tall; ours are scaled to 0.78 of that.
export const MODEL_SCALE = 0.78
export const TILE = 2 * MODEL_SCALE

export const SOLID = 0
export const WARNING = 1
export const FALLEN = 2

export type FloorTile = {
  // Grid position in tiles from the centre, and the same in world units.
  i: number
  j: number
  x: number
  z: number
  // A fixed pseudo-random value in [0, 1), used to choose which model variant the tile shows.
  look: number
  // When this tile drops, as a fraction of the stage's collapse time. null if it never falls.
  fallAt: number | null
}

export const floor = {
  tiles: [] as FloorTile[],
  // SOLID, WARNING or FALLEN for each tile, in the same order as tiles.
  phase: [] as number[],
  index: new Map<string, number>(),
}

// The same value on every client for a given tile, so both players see the same floor.
const hash = (i: number, j: number) => {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return n - Math.floor(n)
}

const key = (i: number, j: number) => `${i},${j}`

// Reads a stage's map into tiles and queues the falling ones: outermost first, shuffled by
// the stage's chaos. Becomes the live floor.
export function buildFloor(stage: Stage): FloorTile[] {
  const rows = stage.map
  const midRow = (rows.length - 1) / 2
  const midCol = (rows[0].length - 1) / 2
  const tiles: (FloorTile & { dist: number })[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.') continue
      const i = c - midCol
      const j = r - midRow
      tiles.push({ i, j, x: i * TILE, z: j * TILE, look: hash(i + 17, j - 5), fallAt: row[c] === '#' ? null : 0, dist: Math.hypot(i, j) })
    }
  })

  const farthest = Math.max(...tiles.map((t) => t.dist), 1)
  const order = (t: FloorTile & { dist: number }) => (1 - stage.chaos) * (t.dist / farthest) + stage.chaos * hash(t.i, t.j)
  const falling = tiles.filter((t) => t.fallAt !== null).sort((a, b) => order(b) - order(a))
  falling.forEach((t, rank) => (t.fallAt = rank / falling.length))

  floor.tiles = tiles
  floor.phase = tiles.map(() => SOLID)
  floor.index = new Map(tiles.map((t, n) => [key(t.i, t.j), n]))
  return tiles
}

const tileAt = (x: number, z: number) => floor.index.get(key(Math.round(x / TILE), Math.round(z / TILE))) ?? -1

// Whether there is floor here that is not about to go.
export function isSafe(x: number, z: number) {
  const n = tileAt(x, z)
  return n >= 0 && floor.phase[n] === SOLID
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// The centre of the next tile to walk to on the shortest safe route between two points, or null
// if there is none. Only steps between tiles that share an edge, so the route never cuts a corner over a gap.
export function routeStep(fromX: number, fromZ: number, toX: number, toZ: number): { x: number; z: number } | null {
  const start = tileAt(fromX, fromZ)
  const goal = tileAt(toX, toZ)
  if (start < 0 || goal < 0) return null
  if (start === goal) return { x: toX, z: toZ }

  // Search backwards from the goal, so the first tile reached next to the start is the step to take.
  const cameFrom = new Map<number, number>([[goal, goal]])
  const queue = [goal]
  while (queue.length > 0) {
    const n = queue.shift()!
    const t = floor.tiles[n]
    for (const [di, dj] of NEIGHBOURS) {
      const next = floor.index.get(key(t.i + di, t.j + dj))
      if (next === undefined || cameFrom.has(next)) continue
      if (next === start) return { x: t.x, z: t.z }
      if (floor.phase[next] !== SOLID) continue
      cameFrom.set(next, n)
      queue.push(next)
    }
  }
  return null
}

// The best nearby tile to retreat to: close, and preferably one that will be standing longest.
export function refuge(x: number, z: number): { x: number; z: number } | null {
  let best: FloorTile | null = null
  let bestScore = Infinity
  floor.tiles.forEach((t, n) => {
    if (floor.phase[n] !== SOLID) return
    const score = Math.hypot(t.x - x, t.z - z) - (t.fallAt ?? 1.5) * TILE * 3
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  })
  return best
}
