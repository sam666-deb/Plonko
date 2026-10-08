import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { PowerKind } from './fighters'
import { ITEM_SIZE, POWER_COLORS, itemsOnFloor } from './powerups'

// Enough for every item a round can produce.
const SLOTS = 6
const KIND_ORDER: PowerKind[] = ['heavy', 'quick', 'shock']

// Draws the power-ups lying on the floor: a spinning, bobbing shape per kind.
// A fixed pool of slots is reused, each showing whichever item it is given this frame.
export function FloorItems() {
  const slots = useRef<(Group | null)[]>([])

  useFrame(({ clock }) => {
    const items = itemsOnFloor()
    for (let n = 0; n < SLOTS; n++) {
      const slot = slots.current[n]
      if (!slot) continue
      const item = items[n]
      slot.visible = Boolean(item)
      if (!item) continue
      slot.position.set(item.x, 0.75 + 0.12 * Math.sin(clock.elapsedTime * 3 + item.n), item.z)
      slot.rotation.y = clock.elapsedTime * 2
      // One child per kind; show the one that matches.
      slot.children.forEach((child, k) => (child.visible = KIND_ORDER[k] === item.kind))
    }
  })

  return (
    <>
      {Array.from({ length: SLOTS }, (_, n) => (
        <group key={n} ref={(g) => void (slots.current[n] = g)} visible={false}>
          <mesh castShadow>
            <boxGeometry args={[ITEM_SIZE * 1.5, ITEM_SIZE * 1.5, ITEM_SIZE * 1.5]} />
            <meshStandardMaterial color={POWER_COLORS.heavy} emissive={POWER_COLORS.heavy} emissiveIntensity={0.8} />
          </mesh>
          <mesh castShadow>
            <octahedronGeometry args={[ITEM_SIZE * 1.1]} />
            <meshStandardMaterial color={POWER_COLORS.quick} emissive={POWER_COLORS.quick} emissiveIntensity={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[ITEM_SIZE, ITEM_SIZE * 0.32, 10, 24]} />
            <meshStandardMaterial color={POWER_COLORS.shock} emissive={POWER_COLORS.shock} emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </>
  )
}
