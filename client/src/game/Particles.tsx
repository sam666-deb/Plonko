import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { InstancedMesh } from 'three'
import { Color, Object3D } from 'three'
import { MAX_PARTICLES, particles } from './effects'

const GRAVITY = 14
const dummy = new Object3D()
const color = new Color()

// Draws the particle pool as one instanced mesh, so every spark shares a single draw call.
export function Particles() {
  const mesh = useRef<InstancedMesh>(null)

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    for (let i = 0; i < MAX_PARTICLES; i++) {
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set('#ffffff'))
    }
  }, [])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i]
      if (p.life > 0) {
        p.life -= dt
        p.vy -= GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        m.setColorAt(i, color.set(p.color))
      }
      // Shrinks to nothing as it dies, which also hides unused slots.
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.setScalar(p.life > 0 ? p.size * (p.life / p.maxLife) : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
