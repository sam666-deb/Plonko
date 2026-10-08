import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Theme } from '@plonko/shared'
import { CanvasTexture } from 'three'

const DUNGEON = import.meta.env.BASE_URL + 'models/dungeon/'
const PILLAR_URL = `${DUNGEON}pillar.glb`
const TORCH_URL = `${DUNGEON}torch_lit.glb`

const SCALE = 0.78
const PILLAR_HEIGHT = 4 * SCALE
// Pillar tops stay below the fighters' heads so they never hide the action from the overview camera.
const PILLAR_TOP = 1.2
const STACK = 5
const CORNERS: [number, number][] = [
  [8.4, 8.4],
  [-8.4, 8.4],
  [8.4, -8.4],
  [-8.4, -8.4],
]
const PIT_Y = -13

// A soft round glow fading from the centre colour to a transparent edge colour, drawn to a small canvas.
function glowTexture([centre, edge]: [string, string]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, centre)
  gradient.addColorStop(0.35, `${edge}c0`)
  gradient.addColorStop(1, `${edge}00`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

// The dungeon around the arena: torch-lit stone pillars rising out of a glowing pit.
// Decoration only; none of it has collision.
export function Scenery({ theme }: { theme: Theme }) {
  const pillar = useGLTF(PILLAR_URL).scene
  const torch = useGLTF(TORCH_URL).scene
  const glow = useMemo(() => glowTexture(theme.pit), [theme])

  const pillars = useMemo(
    () => CORNERS.map(() => ({ stack: Array.from({ length: STACK }, () => pillar.clone()), torch: torch.clone() })),
    [pillar, torch],
  )

  return (
    <>
      {CORNERS.map(([x, z], i) => (
        <group key={i} position={[x, PILLAR_TOP, z]}>
          {pillars[i].stack.map((piece, level) => (
            <primitive key={level} object={piece} scale={SCALE} position={[0, -(level + 1) * PILLAR_HEIGHT, 0]} />
          ))}
          <primitive object={pillars[i].torch} scale={SCALE * 1.6} position={[0, 0.5, 0]} />
          <pointLight position={[0, 1.4, 0]} color={theme.torch} intensity={40} distance={16} decay={2} />
        </group>
      ))}

      {/* The pit below: what falling tiles and fighters drop into. */}
      <mesh position={[0, PIT_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -6, 0]} color={theme.pit[1]} intensity={120} distance={22} decay={2} />
    </>
  )
}

useGLTF.preload(PILLAR_URL)
useGLTF.preload(TORCH_URL)
