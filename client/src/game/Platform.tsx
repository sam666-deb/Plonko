import { Suspense, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierCollider } from '@react-three/rapier'
import type { Stage, TileSet } from '@plonko/shared'
import type { Group, Material, Mesh, Object3D } from 'three'
import { Color, MeshStandardMaterial } from 'three'
import { sfx } from '../audio/sfx'
import { burst } from './effects'
import { FALLEN, MODEL_SCALE, SOLID, TILE, WARNING, buildFloor, floor } from './floor'
import type { FloorTile } from './floor'
import { useGame } from './store'

const DUNGEON = import.meta.env.BASE_URL + 'models/dungeon/'
// Each tile set's models, with the share of tiles that use each one. The first is the plain tile.
const TILE_SETS: Record<TileSet, [string, number][]> = {
  stone: [
    ['floor_tile_small', 0.79],
    ['floor_tile_small_broken_A', 0.07],
    ['floor_tile_small_broken_B', 0.07],
    ['floor_tile_small_weeds_A', 0.07],
  ],
  wood: [
    ['floor_wood_small', 0.7],
    ['floor_wood_small_dark', 0.3],
  ],
  dirt: [
    ['floor_dirt_small_A', 0.4],
    ['floor_dirt_small_B', 0.3],
    ['floor_dirt_small_C', 0.2],
    ['floor_dirt_small_weeds', 0.1],
  ],
}
const url = (name: string) => `${DUNGEON}${name}.glb`

// The tile models' top face sits this far above their origin.
const TILE_TOP = 0.05 * MODEL_SCALE
const BLOCK_DEPTH = 0.9
const COLLIDER_HALF_DEPTH = 0.25
const FALL_GRAVITY = 22
const FALL_VISIBLE_S = 1.6
const HOT = new Color('#ff5a36')

// Which of a set's models a tile shows, from its fixed random value.
function variantOf(set: [string, number][], look: number) {
  let total = 0
  for (let n = 0; n < set.length; n++) {
    total += set[n][1]
    if (look < total) return n
  }
  return 0
}

type TopsProps = {
  stage: Stage
  tiles: FloorTile[]
  groups: RefObject<(Group | null)[]>
  // Filled in with each tile's own material, so the floor can make it glow before it drops.
  tops: RefObject<(MeshStandardMaterial | null)[]>
}

// The visible tile models, hung on the floor's tile groups once they have loaded. Kept apart
// from the floor itself so that waiting for a model never holds up the physics.
function TileTops({ stage, tiles, groups, tops }: TopsProps) {
  const set = TILE_SETS[stage.tiles]
  const models = useGLTF(set.map(([name]) => url(name)))

  useEffect(() => {
    const added: [Group, Object3D][] = []
    tiles.forEach((tile, i) => {
      const group = groups.current[i]
      if (!group) return
      const model = models[variantOf(set, tile.look)].scene.clone()
      model.scale.setScalar(MODEL_SCALE)
      model.position.y = -TILE_TOP
      let top: MeshStandardMaterial | null = null
      model.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        mesh.receiveShadow = true
        top ??= (mesh.material as Material).clone() as MeshStandardMaterial
        mesh.material = top
      })
      tops.current[i] = top
      group.add(model)
      added.push([group, model])
    })
    return () => {
      for (const [group, model] of added) group.remove(model)
      tops.current = []
    }
  }, [tiles, models, set, groups, tops])

  return null
}

// The arena floor for one stage: tiles that warn and then fall away as the round goes on, so a
// round cannot be stalled out.
export function Platform({ stage }: { stage: Stage }) {
  const tiles = useMemo(() => buildFloor(stage), [stage])
  const colors = useMemo(() => ({ tint: new Color(stage.theme.tint), stone: new Color(stage.theme.block) }), [stage])
  // Each tile gets its own block material so it can glow on its own before it drops.
  const blocks = useMemo(() => tiles.map(() => new MeshStandardMaterial({ color: colors.stone, roughness: 1 })), [tiles, colors])

  const groups = useRef<(Group | null)[]>([])
  const tops = useRef<(MeshStandardMaterial | null)[]>([])
  const colliders = useRef<(RapierCollider | null)[]>([])
  const fellAt = useRef<number[]>([])
  // What each collider was last told, so it is only touched when its tile changes state.
  const enabled = useRef<boolean[]>([])

  useBeforePhysicsStep(() => {
    const g = useGame.getState()
    // Hold the floor once the round is decided, so the result is not changed by a late drop.
    if (g.banner || g.match) return
    // Only a round with an opponent loses tiles; the landing page and a room of one keep the full floor.
    const contested = g.mode === 'solo' || g.peers.length > 0
    const t = contested ? (performance.now() - g.playAt) / 1000 - stage.collapseDelay : -Infinity

    tiles.forEach((tile, i) => {
      const dropTime = tile.fallAt === null ? Infinity : tile.fallAt * stage.collapseTime
      const next = t >= dropTime ? FALLEN : t >= dropTime - stage.warn ? WARNING : SOLID
      const standing = next !== FALLEN
      if (enabled.current[i] !== standing) {
        enabled.current[i] = standing
        colliders.current[i]?.setEnabled(standing)
      }
      if (next === floor.phase[i]) return
      floor.phase[i] = next
      if (next === FALLEN) {
        fellAt.current[i] = performance.now()
        sfx.crumble()
        burst({ x: tile.x, y: 0.1, z: tile.z, count: 5, color: stage.theme.block, speed: 1.5, up: 0.8, life: 0.5 })
      }
    })
  })

  useFrame(({ clock }) => {
    const now = performance.now()
    const g = useGame.getState()
    // Once the round is decided the floor is frozen, so tiles caught mid-warning stop flashing.
    const decided = Boolean(g.banner || g.match)
    tiles.forEach((tile, i) => {
      const group = groups.current[i]
      if (!group) return
      const fallen = floor.phase[i] === FALLEN
      const warning = floor.phase[i] === WARNING && !decided
      const warn = warning ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 22 + i) : 0
      tops.current[i]?.color.copy(colors.tint).lerp(HOT, warn * 0.7)
      blocks[i].color.copy(colors.stone).lerp(HOT, warn * 0.7)

      if (fallen) {
        const dt = (now - fellAt.current[i]) / 1000
        group.visible = dt < FALL_VISIBLE_S
        group.position.set(tile.x, -0.5 * FALL_GRAVITY * dt * dt, tile.z)
        group.rotation.set(dt * (1 + tile.look), 0, dt * 0.8)
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
          {/* The pack's tiles are thin slabs; this gives each one a chunk of stone underneath. */}
          <mesh position={[0, -TILE_TOP - 0.1 - BLOCK_DEPTH / 2, 0]} material={blocks[i]}>
            <boxGeometry args={[TILE * 0.94, BLOCK_DEPTH, TILE * 0.94]} />
          </mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        <TileTops stage={stage} tiles={tiles} groups={groups} tops={tops} />
      </Suspense>
    </RigidBody>
  )
}

for (const set of Object.values(TILE_SETS)) for (const [name] of set) useGLTF.preload(url(name))
