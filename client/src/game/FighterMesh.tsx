import { Suspense } from 'react'
import type { Ref } from 'react'
import type { Avatar } from '@plonko/shared'
import type { Group, MeshBasicMaterial } from 'three'
import { Character } from './Character'
import type { Anim } from './Character'
import { Slash } from './Slash'
import { CAPSULE_RADIUS, REST_Y } from './tuning'

type Props = {
  avatar: Avatar
  color: string
  getAnim: () => Anim
  groupRef: Ref<Group>
  // The ground ring's material, so the owner can dim it (the local fighter does while its dash recharges).
  ringRef?: Ref<MeshBasicMaterial>
}

// What a fighter looks like: the character model plus a ring in the player's colour at its feet.
// Shared by local and remote fighters. The group's origin is at the feet, so squashing keeps them planted.
export function FighterMesh({ avatar, color, getAnim, groupRef, ringRef }: Props) {
  return (
    <group position={[0, -REST_Y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[CAPSULE_RADIUS * 1.25, CAPSULE_RADIUS * 1.6, 40]} />
        <meshBasicMaterial ref={ringRef} color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <group ref={groupRef}>
        <Slash color={color} getAnim={getAnim} />
        {/* The model loads in the background; the fighter is already simulated before it appears. */}
        <Suspense fallback={null}>
          <Character avatar={avatar} color={color} getAnim={getAnim} />
        </Suspense>
      </group>
    </group>
  )
}
