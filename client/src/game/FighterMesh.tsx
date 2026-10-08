import type { Ref } from 'react'
import type { Group, MeshStandardMaterial } from 'three'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS } from './tuning'

type Props = { color: string; groupRef: Ref<Group>; materialRef?: Ref<MeshStandardMaterial> }

// Capsule with a nose showing which way it faces. Shared by local and remote fighters.
export function FighterMesh({ color, groupRef, materialRef }: Props) {
  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <capsuleGeometry args={[CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 8, 16]} />
        <meshStandardMaterial ref={materialRef} color={color} />
      </mesh>
      <mesh position={[0, 0.3, CAPSULE_RADIUS]} castShadow>
        <boxGeometry args={[0.3, 0.15, 0.25]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  )
}
