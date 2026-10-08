import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import type { Avatar } from '@plonko/shared'
import type { Group } from 'three'
import { sfx } from '../audio/sfx'
import { sampleRemote, sendHit } from '../net/net'
import { KO_Y, burst, knockoutEffect } from './effects'
import { ATTACK_ANIM_S } from './Character'
import type { Anim } from './Character'
import { FighterMesh } from './FighterMesh'
import { fighters, poseFighter } from './fighters'
import { useGame } from './store'
import { REST_Y } from './tuning'

type Props = { id: string; avatar: Avatar; color: string; spawn: [number, number] }

// How long the hit animation shows on a proxy after we hit it; its owner's stun is not sent to us.
const HIT_ANIM_S = 0.4

// Another player's fighter: a kinematic body that follows their broadcast position. It has no
// collider; local fighters work out bumps and dash hits against it themselves.
export function RemoteFighter({ id, avatar, color, spawn }: Props) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const round = useGame((s) => s.round)
  const state = useRef({ headingX: 0, headingZ: 1, velX: 0, velZ: 0, y: REST_Y, hit: 0, attack: 0, dashing: false, squash: 0, koShown: false })

  useEffect(() => {
    const b = body.current
    if (!b) return
    fighters.set(id, {
      body: b,
      remote: true,
      hitPower: () => 1,
      heading: () => [state.current.headingX, state.current.headingZ],
      velocity: () => [state.current.velX, state.current.velZ],
      isDashing: () => state.current.dashing,
      takeHit: (dvx, dvz, up) => {
        state.current.squash = 1
        state.current.hit = HIT_ANIM_S
        sendHit(id, dvx, dvz, up)
      },
      push: () => {},
    })
    return () => void fighters.delete(id)
  }, [id])

  useEffect(() => {
    state.current.koShown = false
    body.current?.setTranslation({ x: spawn[0], y: REST_Y, z: spawn[1] }, true)
  }, [round, spawn])

  useBeforePhysicsStep(() => {
    const b = body.current
    const snap = sampleRemote(id)
    if (!b || !snap) return
    const s = state.current
    s.headingX = snap.h[0]
    s.headingZ = snap.h[1]
    s.velX = snap.v[0]
    s.velZ = snap.v[1]
    const [x, y, z] = snap.p
    s.y = y
    if (snap.d && !s.dashing) {
      s.attack = ATTACK_ANIM_S
      sfx.dash(0.6)
      burst({ x, y: y - 0.6, z, count: 8, color, speed: 2, dirX: -snap.h[0], dirZ: -snap.h[1], push: 3 })
    }
    if (snap.d) burst({ x, y: y - 0.3, z, count: 1, color, speed: 0.6, up: 0.3, life: 0.3, size: 0.2 })
    if (y < KO_Y && !s.koShown) {
      s.koShown = true
      knockoutEffect(x, z, color)
    }
    s.dashing = snap.d
    b.setNextKinematicTranslation({ x, y, z })
  })

  useFrame((_, dt) => {
    const s = state.current
    s.squash = Math.max(0, s.squash - dt * 5)
    s.hit = Math.max(0, s.hit - dt)
    s.attack = Math.max(0, s.attack - dt)
    if (visual.current) poseFighter(visual.current, s.headingX, s.headingZ, s.squash, s.dashing)
  })

  function getAnim(): Anim {
    const s = state.current
    const g = useGame.getState()
    if (s.y < REST_Y - 0.5) return 'fall'
    if (s.hit > 0) return 'hit'
    if (s.attack > 0) return 'attack'
    // The results are from the local player's side, so the rival reacts the opposite way.
    if (g.match) return g.match === 'won' ? 'defeat' : 'cheer'
    if (g.banner) return g.banner === 'Knockout!' ? 'idle' : 'taunt'
    return Math.hypot(s.velX, s.velZ) > 1 ? 'run' : 'idle'
  }

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], REST_Y, spawn[1]]}>
      <FighterMesh avatar={avatar} color={color} getAnim={getAnim} groupRef={visual} />
    </RigidBody>
  )
}
