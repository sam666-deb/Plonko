import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { POWER_BITS } from '@plonko/shared'
import type { Ref } from 'react'
import type { Avatar } from '@plonko/shared'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { Character } from './Character'
import type { Anim } from './Character'
import { Guard } from './Guard'
import { POWER_COLORS } from './powerups'
import { Slash } from './Slash'
import { CAPSULE_RADIUS, REST_Y } from './tuning'

type Props = {
  avatar: Avatar
  color: string
  getAnim: () => Anim
  // How full the fighter's guard is while it blocks, 0 to 1; 0 when it is not blocking.
  getGuard: () => number
  // The fighter's active power-ups, as a POWER_BITS mask.
  getPowers: () => number
  // Shown above the fighter's head; left out on the landing page.
  name?: string
  groupRef: Ref<Group>
  // The ground ring's material, so the owner can dim it (the local fighter does while its dash recharges).
  ringRef?: Ref<MeshBasicMaterial>
}

// What a fighter looks like: the character model plus a ring in the player's colour at its feet.
// Shared by local and remote fighters. The group's origin is at the feet, so squashing keeps them planted.
// A wide pulsing ring under a fighter with a timed power-up, in that power-up's colour.
function Aura({ getPowers }: { getPowers: () => number }) {
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m || !material.current) return
    const powers = getPowers()
    m.visible = powers > 0
    if (!m.visible) return
    // With both active the ring alternates between the two colours.
    const both = powers === (POWER_BITS.heavy | POWER_BITS.quick)
    const heavy = both ? Math.floor(clock.elapsedTime * 3) % 2 === 0 : Boolean(powers & POWER_BITS.heavy)
    material.current.color.set(heavy ? POWER_COLORS.heavy : POWER_COLORS.quick)
    m.scale.setScalar(1 + 0.1 * Math.sin(clock.elapsedTime * 9))
  })
  return (
    <mesh ref={mesh} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <ringGeometry args={[CAPSULE_RADIUS * 1.8, CAPSULE_RADIUS * 2.3, 40]} />
      <meshBasicMaterial ref={material} transparent opacity={0.8} toneMapped={false} />
    </mesh>
  )
}

export function FighterMesh({ avatar, color, getAnim, getGuard, getPowers, name, groupRef, ringRef }: Props) {
  return (
    <group position={[0, -REST_Y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[CAPSULE_RADIUS * 1.25, CAPSULE_RADIUS * 1.6, 40]} />
        <meshBasicMaterial ref={ringRef} color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <Aura getPowers={getPowers} />
      {name && (
        // Kept low in the page's stacking order so it never draws over the HUD or menus.
        <Html center position={[0, 2.15, 0]} zIndexRange={[5, 0]} className="nametag" style={{ color }}>
          {name}
        </Html>
      )}
      <group ref={groupRef}>
        <Slash color={color} getAnim={getAnim} />
        <Guard getGuard={getGuard} />
        {/* The model loads in the background; the fighter is already simulated before it appears. */}
        <Suspense fallback={null}>
          <Character avatar={avatar} color={color} getAnim={getAnim} />
        </Suspense>
      </group>
    </group>
  )
}
