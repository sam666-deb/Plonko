import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { DoubleSide } from 'three'

const ARC = 2.6

// A bright arc held in front of a fighter while it blocks. It fades as the guard runs down,
// so the player can see how much longer the block will hold. getGuard returns 0 when not blocking.
export function Guard({ getGuard }: { getGuard: () => number }) {
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m || !material.current) return
    const guard = getGuard()
    m.visible = guard > 0
    if (!m.visible) return
    material.current.opacity = 0.25 + 0.65 * guard
    m.scale.setScalar(1 + 0.03 * Math.sin(clock.elapsedTime * 14))
  })

  // Lying flat at chest height, centred on the fighter's forward axis like the slash arc.
  return (
    <mesh ref={mesh} visible={false} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.72, 0.88, 28, 1, Math.PI / 2 - ARC / 2, ARC]} />
      <meshBasicMaterial ref={material} color="#dff4ff" transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}
