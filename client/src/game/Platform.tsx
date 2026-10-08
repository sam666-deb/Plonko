import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierCollider } from '@react-three/rapier'
import type { Group, Material, Mesh } from 'three'
import { Color, MeshStandardMaterial } from 'three'
import { sfx } from '../audio/sfx'
import { burst } from './effects'
import { arena, useGame } from './store'
import { tuning } from './tuning'

const DUNGEON = import.meta.env.BASE_URL + 'models/dungeon/'
// Mostly plain tiles, with the odd broken or overgrown one.
const VARIANTS = ['floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A'].map(
  (name) => `${DUNGEON}${name}.glb`,
)
// The pack is built for characters about 2.2 units tall; ours are scaled to 0.78 of that.
const SCALE = 0.78
const TILE = 2 * SCALE
// The tile model's top face sits this far above its origin.
const TILE_TOP = 0.05 * SCALE
const BLOCK_DEPTH = 0.9
const COLLIDER_HALF_DEPTH = 0.25

// A tile shakes and glows for this long before it drops.
const WARN_S = 1
const FALL_GRAVITY = 22
const FALL_VISIBLE_S = 1.6
const SOLID = 0
const WARNING = 1
const FALLEN = 2

const STONE = new Color('#4a4458')
const HOT = new Color('#ff5a36')

type Tile = {
  x: number
  z: number
  variant: number
  // When this tile drops, as a fraction of the shrink time. null for the centre tiles that never fall.
  fallAt: number | null
}

// Same pseudo-random value on every client for a given tile, so both players see the same floor.
const hash = (i: number, j: number) => {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return n - Math.floor(n)
}

// A grid of square tiles trimmed to a circle. The outer ones are queued to drop, roughly
// from the outside in, until only the tiles within minRadius are left.
function layout(radius: number, minRadius: number): Tile[] {
  const n = Math.ceil(radius / TILE)
  const tiles: (Tile & { order: number })[] = []
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const dist = Math.hypot(i, j) * TILE
      if (dist > radius - TILE * 0.35) continue
      const h = hash(i, j)
      const variant = h > 0.93 ? 3 : h > 0.86 ? 2 : h > 0.79 ? 1 : 0
      const stays = dist <= minRadius + TILE * 0.2
      tiles.push({ x: i * TILE, z: j * TILE, variant, fallAt: stays ? null : 0, order: dist - h * TILE * 0.9 })
    }
  }
  const falling = tiles.filter((t) => t.fallAt !== null).sort((a, b) => b.order - a.order)
  falling.forEach((t, rank) => (t.fallAt = rank / falling.length))
  return tiles
}

// The arena floor: stone tiles that fall away as the round goes on, so a round cannot be stalled out.
export function Platform({ radius }: { radius: number }) {
  const models = useGLTF(VARIANTS)
  const tiles = useMemo(() => layout(radius, Math.min(tuning.minRadius, radius)), [radius])

  // Each tile gets its own materials so it can glow on its own before it drops.
  const parts = useMemo(
    () =>
      tiles.map((tile) => {
        const model = models[tile.variant].scene.clone()
        let top: MeshStandardMaterial | null = null
        model.traverse((o) => {
          const mesh = o as Mesh
          if (!mesh.isMesh) return
          mesh.receiveShadow = true
          top ??= (mesh.material as Material).clone() as MeshStandardMaterial
          mesh.material = top
        })
        return { model, top: top as MeshStandardMaterial | null, block: new MeshStandardMaterial({ color: STONE, roughness: 1 }) }
      }),
    [tiles, models],
  )

  const groups = useRef<(Group | null)[]>([])
  const colliders = useRef<(RapierCollider | null)[]>([])
  const phase = useRef<number[]>([])
  const fellAt = useRef<number[]>([])

  useBeforePhysicsStep(() => {
    const g = useGame.getState()
    // Hold the floor once the round is decided, so the result is not changed by a late drop.
    if (g.banner || g.match) return
    // Only a round with an opponent loses tiles; the landing page and a room of one keep the full floor.
    const contested = g.mode === 'solo' || g.peers.length > 0
    const t = contested ? (performance.now() - g.playAt) / 1000 - tuning.shrinkDelay : -Infinity

    let safe = radius
    tiles.forEach((tile, i) => {
      const dropTime = tile.fallAt === null ? Infinity : tile.fallAt * tuning.shrinkTime
      const next = t >= dropTime ? FALLEN : t >= dropTime - WARN_S ? WARNING : SOLID
      if (next !== SOLID) safe = Math.min(safe, Math.hypot(tile.x, tile.z) - TILE * 0.5)
      if (next === phase.current[i]) return
      phase.current[i] = next
      colliders.current[i]?.setEnabled(next !== FALLEN)
      if (next === FALLEN) {
        fellAt.current[i] = performance.now()
        sfx.crumble()
        burst({ x: tile.x, y: 0.1, z: tile.z, count: 5, color: '#8b8498', speed: 1.5, up: 0.8, life: 0.5 })
      }
    })
    // The bot steers by this: how far from the centre the floor is still trustworthy.
    arena.radius = safe
  })

  useFrame(({ clock }) => {
    const now = performance.now()
    const g = useGame.getState()
    // Once the round is decided the floor is frozen, so tiles caught mid-warning stop flashing.
    const decided = Boolean(g.banner || g.match)
    tiles.forEach((tile, i) => {
      const group = groups.current[i]
      if (!group) return
      const fallen = phase.current[i] === FALLEN
      const warning = phase.current[i] === WARNING && !decided
      const { top, block } = parts[i]
      const warn = warning ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 22 + i) : 0
      top?.color.setScalar(1).lerp(HOT, warn * 0.7)
      block.color.copy(STONE).lerp(HOT, warn * 0.7)

      if (fallen) {
        const dt = (now - fellAt.current[i]) / 1000
        group.visible = dt < FALL_VISIBLE_S
        group.position.set(tile.x, -0.5 * FALL_GRAVITY * dt * dt, tile.z)
        group.rotation.set(dt * (tile.variant + 1) * 0.5, 0, dt * 0.8)
        return
      }
      const shake = warning ? 0.045 : 0
      group.visible = true
      group.position.set(tile.x + (Math.random() - 0.5) * shake, 0, tile.z + (Math.random() - 0.5) * shake)
      group.rotation.set(0, 0, 0)
    })
  })

  return (
    <RigidBody type="fixed" colliders={false}>
      {tiles.map((tile, i) => (
        <CuboidCollider
          key={`c${i}`}
          ref={(c) => void (colliders.current[i] = c)}
          args={[TILE / 2, COLLIDER_HALF_DEPTH, TILE / 2]}
          position={[tile.x, -COLLIDER_HALF_DEPTH, tile.z]}
          friction={0}
        />
      ))}
      {tiles.map((tile, i) => (
        <group key={`t${i}`} ref={(g) => void (groups.current[i] = g)} position={[tile.x, 0, tile.z]}>
          <primitive object={parts[i].model} scale={SCALE} position={[0, -TILE_TOP, 0]} />
          {/* The pack's tiles are thin slabs; this gives each one a chunk of stone underneath. */}
          <mesh position={[0, -TILE_TOP - 0.1 - BLOCK_DEPTH / 2, 0]} material={parts[i].block}>
            <boxGeometry args={[TILE * 0.94, BLOCK_DEPTH, TILE * 0.94]} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

for (const url of VARIANTS) useGLTF.preload(url)
