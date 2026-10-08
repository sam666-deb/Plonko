import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import type { Group } from 'three'
import { sampleRemote, sendHit } from '../net/net'
import { FighterMesh } from './FighterMesh'
import { fighters, poseFighter } from './fighters'
import { useGame } from './store'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, REST_Y } from './tuning'

type Props = { id: string; color: string; spawn: [number, number] }

// Another player's fighter: a kinematic body that follows their broadcast position.
export function RemoteFighter({ id, color, spawn }: Props) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const round = useGame((s) => s.round)
  const state = useRef({ headingX: 0, headingZ: 1, dashing: false, squash: 0 })

  useEffect(() => {
    const b = body.current
    if (!b) return
    fighters.set(id, {
      body: b,
      remote: true,
      hitPower: () => 1,
      heading: () => [state.current.headingX, state.current.headingZ],
      isDashing: () => state.current.dashing,
      takeHit: (dirX, dirZ, power) => {
        state.current.squash = 1
        sendHit(id, dirX, dirZ, power)
      },
    })
    return () => void fighters.delete(id)
  }, [id])

  useEffect(() => {
    body.current?.setTranslation({ x: spawn[0], y: REST_Y, z: spawn[1] }, true)
  }, [round, spawn])

  useBeforePhysicsStep(() => {
    const b = body.current
    const snap = sampleRemote(id)
    if (!b || !snap) return
    const s = state.current
    s.headingX = snap.h[0]
    s.headingZ = snap.h[1]
    s.dashing = snap.d
    b.setNextKinematicTranslation({ x: snap.p[0], y: snap.p[1], z: snap.p[2] })
  })

  useFrame((_, dt) => {
    const s = state.current
    s.squash = Math.max(0, s.squash - dt * 5)
    if (visual.current) poseFighter(visual.current, s.headingX, s.headingZ, s.squash, s.dashing)
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], REST_Y, spawn[1]]}>
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0} restitution={0} />
      <FighterMesh color={color} groupRef={visual} />
    </RigidBody>
  )
}
