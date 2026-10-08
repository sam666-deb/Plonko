import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Hazard, Stage } from '@plonko/shared'
import type { Group, Mesh } from 'three'
import { TILE } from './floor'
import { BUMPER_RADIUS, SWEEPER_HALF_WIDTH, hazardClock, spikeState, sweeperAngle, tileStands } from './hazards'

const SWEEPER_Y = 0.45
const SPIKE_HEIGHT = 0.9
// Where the nine spikes sit on a tile, as fractions of half its width.
const SPIKE_GRID = [-0.6, 0, 0.6]

function Sweeper({ hazard }: { hazard: Extract<Hazard, { type: 'sweeper' }> }) {
  const arm = useRef<Group>(null)
  useFrame(() => {
    // The bar lies along (cos a, sin a) on the ground plane; turning a group about Y by -a does that.
    if (arm.current) arm.current.rotation.y = -sweeperAngle(hazard, hazardClock())
  })
  const length = hazard.length * TILE * 2
  return (
    <group>
      <group ref={arm} position={[0, SWEEPER_Y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[length, SWEEPER_HALF_WIDTH * 2, SWEEPER_HALF_WIDTH * 2]} />
          <meshStandardMaterial color="#ff5a36" emissive="#ff2a12" emissiveIntensity={0.9} roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[0, SWEEPER_Y, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, SWEEPER_Y * 2 + 0.3, 16]} />
        <meshStandardMaterial color="#3b3442" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Spikes({ hazard }: { hazard: Extract<Hazard, { type: 'spikes' }> }) {
  const groups = useRef<(Group | null)[]>([])
  useFrame(() => {
    const { height } = spikeState(hazard, hazardClock())
    hazard.tiles.forEach(([i, j], n) => {
      const group = groups.current[n]
      if (!group) return
      group.visible = tileStands(i, j)
      // Kept just above zero so the tips stay visible and mark the tile as trapped.
      group.scale.y = Math.max(0.08, height)
    })
  })
  return (
    <>
      {hazard.tiles.map(([i, j], n) => (
        <group key={n} ref={(g) => void (groups.current[n] = g)} position={[i * TILE, 0, j * TILE]}>
          {SPIKE_GRID.flatMap((x) =>
            SPIKE_GRID.map((z) => (
              <mesh key={`${x},${z}`} position={[(x * TILE) / 2, SPIKE_HEIGHT / 2, (z * TILE) / 2]} castShadow>
                <coneGeometry args={[0.13, SPIKE_HEIGHT, 6]} />
                <meshStandardMaterial color="#d7dbe6" metalness={0.8} roughness={0.25} emissive="#ff3b1f" emissiveIntensity={0.25} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </>
  )
}

function Bumper({ hazard }: { hazard: Extract<Hazard, { type: 'bumper' }> }) {
  const mesh = useRef<Mesh>(null)
  const [i, j] = hazard.at
  useFrame(({ clock }) => {
    if (!mesh.current) return
    mesh.current.visible = tileStands(Math.round(i), Math.round(j))
    mesh.current.scale.setScalar(1 + 0.04 * Math.sin(clock.elapsedTime * 6 + i))
  })
  return (
    <mesh ref={mesh} position={[i * TILE, 0.45, j * TILE]} castShadow>
      <cylinderGeometry args={[BUMPER_RADIUS, BUMPER_RADIUS * 1.1, 0.9, 20]} />
      <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.7} roughness={0.3} />
    </mesh>
  )
}

// Draws a stage's hazards. What they do to fighters is in hazards.ts.
export function StageHazards({ stage }: { stage: Stage }) {
  return (
    <>
      {stage.hazards.map((hazard, n) =>
        hazard.type === 'sweeper' ? (
          <Sweeper key={n} hazard={hazard} />
        ) : hazard.type === 'spikes' ? (
          <Spikes key={n} hazard={hazard} />
        ) : (
          <Bumper key={n} hazard={hazard} />
        ),
      )}
    </>
  )
}
