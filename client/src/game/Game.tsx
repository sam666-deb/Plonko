import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CylinderCollider, Physics, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierCollider } from '@react-three/rapier'
import type { Mesh } from 'three'
import { keyboardIntent } from '../input/keyboard'
import { botIntent } from './bot'
import { Fighter } from './Fighter'
import { Particles } from './Particles'
import { RemoteFighter } from './RemoteFighter'
import { useSettings } from './settings'
import { arena, fx, sideOf, useGame } from './store'
import { tuning, useTuning } from './tuning'

const CAMERA_POS: [number, number, number] = [0, 15, 12]
const PLATFORM_HALF_HEIGHT = 0.25
const SPAWNS: [number, number][] = [
  [0, 3],
  [0, -3],
]
const COLORS = ['#38bdf8', '#f87171']

// The platform shrinks as the round goes on, so a round cannot be stalled out.
function Arena({ radius }: { radius: number }) {
  const collider = useRef<RapierCollider>(null)
  const mesh = useRef<Mesh>(null)

  useBeforePhysicsStep(() => {
    const g = useGame.getState()
    // Hold the size once the round is decided, so the result is not changed by a late shrink.
    if (g.banner || g.match) return
    // Only a round with an opponent shrinks; the landing page and a room of one stay full size.
    const contested = g.mode === 'solo' || g.peers.length > 0
    const elapsed = (performance.now() - g.playAt) / 1000 - tuning.shrinkDelay
    const k = contested ? Math.min(1, Math.max(0, elapsed / tuning.shrinkTime)) : 0
    const r = radius + (Math.min(tuning.minRadius, radius) - radius) * k
    if (r === arena.radius) return
    arena.radius = r
    collider.current?.setRadius(r)
    mesh.current?.scale.set(r / radius, 1, r / radius)
  })

  return (
    <RigidBody type="fixed" colliders={false} position={[0, -PLATFORM_HALF_HEIGHT, 0]}>
      <CylinderCollider ref={collider} args={[PLATFORM_HALF_HEIGHT, radius]} friction={0} />
      <mesh ref={mesh} receiveShadow>
        <cylinderGeometry args={[radius, radius, PLATFORM_HALF_HEIGHT * 2, 48]} />
        <meshStandardMaterial color="#c3c9e6" />
      </mesh>
    </RigidBody>
  )
}

// Fixed overview camera behind the local player's side; only moves to shake on a hit.
// Behind the landing page it circles the arena slowly instead.
function CameraRig() {
  const side = useGame((s) => sideOf(s.slot))
  const landing = useGame((s) => s.mode === 'landing')
  useFrame(({ camera, clock }, dt) => {
    if (landing) {
      const angle = clock.elapsedTime * 0.12
      camera.position.set(Math.sin(angle) * 14, 10, Math.cos(angle) * 14)
      camera.lookAt(0, 0, 0)
      return
    }
    fx.shake = Math.max(0, fx.shake - dt * 3)
    const shake = fx.shake * useSettings.getState().shake
    camera.position.set(
      CAMERA_POS[0] + (Math.random() - 0.5) * shake,
      CAMERA_POS[1] + (Math.random() - 0.5) * shake,
      CAMERA_POS[2] * side,
    )
    camera.lookAt(0, 0, 0)
  })
  return null
}

export function Game() {
  const t = useTuning()
  const frozen = useGame((s) => s.frozen)
  const slot = useGame((s) => s.slot)
  const peers = useGame((s) => s.peers)
  const shadows = useSettings((s) => s.shadows)
  const avatar = useSettings((s) => s.avatar)
  // The bot never wears the same skeleton as the player.
  const botAvatar = avatar === 'minion' ? 'warrior' : 'minion'
  const mode = useGame((s) => s.mode)
  // The menu pauses the game only against the bot; an online match cannot stop for one player.
  const paused = useGame((s) => s.menuOpen && s.mode === 'solo')

  return (
    <Canvas shadows camera={{ position: CAMERA_POS, fov: 42 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, 6]} intensity={1.6} castShadow={shadows} shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, 40]} />
      </directionalLight>
      <CameraRig />
      <Particles />
      <Physics gravity={[0, -t.gravity, 0]} paused={frozen || paused}>
        <Arena key={t.arenaRadius} radius={t.arenaRadius} />
        <Fighter id="me" avatar={avatar} color={COLORS[slot]} spawn={SPAWNS[slot]} getIntent={keyboardIntent} />
        {/* The bot is the solo opponent, and stands on the arena behind the landing page. */}
        {mode !== 'online' ? (
          <Fighter id="bot" avatar={botAvatar} color={COLORS[1]} spawn={SPAWNS[1]} getIntent={botIntent} />
        ) : (
          peers.map((p) => (
            <RemoteFighter key={p.id} id={p.id} avatar={p.avatar} color={COLORS[p.slot]} spawn={SPAWNS[p.slot]} />
          ))
        )}
      </Physics>
    </Canvas>
  )
}
