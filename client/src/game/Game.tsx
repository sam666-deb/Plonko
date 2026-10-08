import { Canvas, useFrame } from '@react-three/fiber'
import { CylinderCollider, Physics, RigidBody } from '@react-three/rapier'
import { keyboardIntent } from '../input/keyboard'
import { botIntent } from './bot'
import { Fighter } from './Fighter'
import { fx, useGame } from './store'
import { useTuning } from './tuning'

const CAMERA_POS: [number, number, number] = [0, 15, 12]
const PLATFORM_HALF_HEIGHT = 0.25
const PLAYER_SPAWN: [number, number] = [0, 3]
const BOT_SPAWN: [number, number] = [0, -3]

function Arena({ radius }: { radius: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[0, -PLATFORM_HALF_HEIGHT, 0]}>
      <CylinderCollider args={[PLATFORM_HALF_HEIGHT, radius]} friction={0} />
      <mesh receiveShadow>
        <cylinderGeometry args={[radius, radius, PLATFORM_HALF_HEIGHT * 2, 48]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
    </RigidBody>
  )
}

// Fixed overview camera; only moves to shake on a hit.
function CameraRig() {
  useFrame(({ camera }, dt) => {
    fx.shake = Math.max(0, fx.shake - dt * 3)
    camera.position.set(
      CAMERA_POS[0] + (Math.random() - 0.5) * fx.shake,
      CAMERA_POS[1] + (Math.random() - 0.5) * fx.shake,
      CAMERA_POS[2],
    )
    camera.lookAt(0, 0, 0)
  })
  return null
}

export function Game() {
  const t = useTuning()
  const frozen = useGame((s) => s.frozen)

  return (
    <Canvas shadows camera={{ position: CAMERA_POS, fov: 42 }}>
      <color attach="background" args={['#1f2937']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, 40]} />
      </directionalLight>
      <CameraRig />
      <Physics gravity={[0, -t.gravity, 0]} paused={frozen}>
        <Arena key={t.arenaRadius} radius={t.arenaRadius} />
        <Fighter id="player" color="#38bdf8" spawn={PLAYER_SPAWN} getIntent={keyboardIntent} />
        <Fighter id="bot" color="#f87171" spawn={BOT_SPAWN} getIntent={botIntent} />
      </Physics>
    </Canvas>
  )
}
