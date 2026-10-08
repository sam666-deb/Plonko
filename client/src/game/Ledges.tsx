import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Theme } from '@plonko/shared'
import { MODEL_SCALE, TILE } from './floor'

const DUNGEON = import.meta.env.BASE_URL + 'models/dungeon/'
const url = (name: string) => `${DUNGEON}${name}.glb`

// A ledge floats to each side of the arena, out of reach across a gap.
const LEDGE_X = 9.4
const LEDGE_Y = -0.5
const TILE_TOP = 0.05 * MODEL_SCALE
const BLOCK_DEPTH = 0.9
// The ledge is two tiles wide and three long. Where its tiles and its three props stand, in
// world units from its centre, with x pointing away from the arena.
const TILES: [number, number][] = [-0.5, 0.5].flatMap((i) => [-1, 0, 1].map((j) => [i * TILE, j * TILE] as [number, number]))
const PROP_SPOTS: [number, number, number][] = [
  [-0.3, -1.45, 0.5],
  [0.1, 0.05, -0.3],
  [-0.35, 1.45, 2.4],
]
const WALL_X = TILE * 0.75

function Ledge({ theme, side }: { theme: Theme; side: 1 | -1 }) {
  const names = ['floor_tile_small', ...theme.props, ...(theme.wall === 'none' ? [] : ['wall_broken']), ...(theme.wall === 'banner' ? ['banner_shield_red'] : [])]
  const models = useGLTF(names.map(url))

  // Each placed copy needs its own clone of the loaded model.
  const pieces = useMemo(() => {
    const tile = models[0].scene
    const props = theme.props.map((_, n) => models[1 + n].scene.clone())
    const wall = theme.wall === 'none' ? null : models[4].scene.clone()
    const banner = theme.wall === 'banner' ? models[5].scene.clone() : null
    for (const piece of [...props, wall, banner]) piece?.traverse((o) => void (o.castShadow = true))
    return { tiles: TILES.map(() => tile.clone()), props, wall, banner }
  }, [models, theme])

  return (
    // The far ledge is the near one turned half round, so both face the arena.
    <group position={[side * LEDGE_X, LEDGE_Y, 0]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
      {TILES.map(([x, z], n) => (
        <group key={n} position={[x, 0, z]}>
          <primitive object={pieces.tiles[n]} scale={MODEL_SCALE} position={[0, -TILE_TOP, 0]} />
          <mesh position={[0, -TILE_TOP - 0.1 - BLOCK_DEPTH / 2, 0]}>
            <boxGeometry args={[TILE * 0.94, BLOCK_DEPTH, TILE * 0.94]} />
            <meshStandardMaterial color={theme.block} roughness={1} />
          </mesh>
        </group>
      ))}
      {pieces.props.map((prop, n) => (
        <primitive key={n} object={prop} scale={MODEL_SCALE} position={[PROP_SPOTS[n][0], 0, PROP_SPOTS[n][1]]} rotation={[0, PROP_SPOTS[n][2], 0]} />
      ))}
      {/* The wall runs along the outer edge; turned this way its banner faces the arena. */}
      {pieces.wall && <primitive object={pieces.wall} scale={MODEL_SCALE} position={[WALL_X, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />}
      {pieces.banner && <primitive object={pieces.banner} scale={MODEL_SCALE} position={[WALL_X, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />}
    </group>
  )
}

// Dressing for the stage: two ledges of props from the dungeon pack, chosen by the stage's theme.
// Decoration only; nothing here has collision.
export function Ledges({ theme }: { theme: Theme }) {
  return (
    <>
      <Ledge theme={theme} side={1} />
      <Ledge theme={theme} side={-1} />
    </>
  )
}
