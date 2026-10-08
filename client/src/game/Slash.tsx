import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { DoubleSide } from 'three'
import type { Anim } from './Character'

// The arc opens this long after the attack starts, to line up with the weapon's strike.
const DELAY = 0.07
const DURATION = 0.22
const ARC = 2.4

// A crescent that sweeps across the front of a fighter as its weapon swings, so the attack
// reads at a glance from the overview camera.
export function Slash({ color, getAnim }: { color: string; getAnim: () => Anim }) {
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const state = useRef({ attacking: false, t: DURATION })

  useFrame((_, dt) => {
    const s = state.current
    const attacking = getAnim() === 'attack'
    if (attacking && !s.attacking) s.t = -DELAY
    s.attacking = attacking
    s.t = Math.min(DURATION, s.t + dt)

    const m = mesh.current
    if (!m || !material.current) return
    const k = s.t / DURATION
    m.visible = k >= 0 && k < 1
    if (!m.visible) return
    m.rotation.z = -0.9 + 1.8 * k
    m.scale.setScalar(0.85 + 0.35 * k)
    material.current.opacity = 0.9 * (1 - k)
  })

  // Lying flat at chest height. With this tilt the ring's +Y points along the fighter's forward
  // axis, so the arc is centred straight ahead.
  return (
    <mesh ref={mesh} visible={false} position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1.3, 24, 1, Math.PI / 2 - ARC / 2, ARC]} />
      <meshBasicMaterial ref={material} color={color} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}
