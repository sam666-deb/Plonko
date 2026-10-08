import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { EMOTES, POWER_BITS } from '@plonko/shared'
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

type Props = { id: string; avatar: Avatar; color: string; spawn: [number, number]; name?: string }

// How long the hit animation shows on a proxy after we hit it; its owner's stun is not sent to us.
const HIT_ANIM_S = 0.4

// Another player's fighter: a kinematic body that follows their broadcast position. It has no
// collider; local fighters work out bumps and dash hits against it themselves.
export function RemoteFighter({ id, avatar, color, spawn, name }: Props) {
  // Read as plain numbers, so a re-render that passes an equal spawn in a new array changes nothing.
  const [spawnX, spawnZ] = spawn
  const startPosition = useMemo<[number, number, number]>(() => [spawnX, REST_Y, spawnZ], [spawnX, spawnZ])
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const round = useGame((s) => s.round)
  const state = useRef({ headingX: 0, headingZ: 1, velX: 0, velZ: 0, y: REST_Y, hit: 0, attack: 0, dashing: false, blocking: false, damage: 0, powers: 0, emote: 0, squash: 0, koShown: false })

  useEffect(() => {
    fighters.set(id, {
      get body() {
        return body.current
      },
      remote: true,
      hitPower: () => 1,
      heading: () => [state.current.headingX, state.current.headingZ],
      velocity: () => [state.current.velX, state.current.velZ],
      isDashing: () => state.current.dashing,
      isBlocking: () => state.current.blocking,
      emote: () => state.current.emote,
      damage: () => state.current.damage,
      powers: () => ({ heavy: state.current.powers & POWER_BITS.heavy ? 1 : 0, quick: state.current.powers & POWER_BITS.quick ? 1 : 0 }),
      grant: () => {},
      takeHit: (dvx, dvz, up) => {
        const s = state.current
        s.squash = 1
        // If they are blocking they will most likely catch it, so skip the hit reaction.
        if (!s.blocking) s.hit = HIT_ANIM_S
        sendHit(id, dvx, dvz, up)
        return false
      },
      recoil: () => {},
      push: () => {},
    })
    return () => void fighters.delete(id)
  }, [id])

  useEffect(() => {
    state.current.koShown = false
    body.current?.setTranslation({ x: spawnX, y: REST_Y, z: spawnZ }, true)
  }, [round, spawnX, spawnZ])

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
    s.blocking = snap.b
    s.damage = snap.dmg
    s.powers = snap.e
    s.emote = snap.em
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
    if (s.blocking) return 'block'
    if (s.y > REST_Y + 0.3) return 'fall'
    if (s.emote > 0) return EMOTES[s.emote - 1] ?? 'idle'
    // The results are from the local player's side, so the rival reacts the opposite way.
    if (g.match) return g.match === 'won' ? 'defeat' : 'cheer'
    if (g.banner) return g.banner === 'Knockout!' ? 'idle' : 'taunt'
    return Math.hypot(s.velX, s.velZ) > 1 ? 'run' : 'idle'
  }

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={startPosition}>
      <FighterMesh
        avatar={avatar}
        color={color}
        getAnim={getAnim}
        // The proxy's guard level is not sent, so a blocking rival's arc is shown at a fixed strength.
        getGuard={() => (state.current.blocking ? 0.8 : 0)}
        getPowers={() => state.current.powers}
        name={name}
        groupRef={visual}
      />
    </RigidBody>
  )
}
