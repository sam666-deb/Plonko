import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import type { Group, MeshStandardMaterial } from 'three'
import { Color } from 'three'
import { reportFall } from '../net/net'
import { FighterMesh } from './FighterMesh'
import { fighters, poseFighter } from './fighters'
import type { Intent } from './fighters'
import { fx, useGame } from './store'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, REST_Y, tuning } from './tuning'

const STEP = 1 / 60

const approach = (current: number, target: number, maxDelta: number) =>
  current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target)

type Props = {
  id: 'me' | 'bot'
  color: string
  spawn: [number, number]
  getIntent: (self: RapierRigidBody) => Intent
}

export function Fighter({ id, color, spawn, getIntent }: Props) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const material = useRef<MeshStandardMaterial>(null)
  const round = useGame((s) => s.round)

  const state = useRef({
    headingX: 0,
    headingZ: 1,
    dashTimer: 0,
    cooldown: 0,
    stun: 0,
    hitLanded: false,
    squash: 0,
    dead: false,
  })

  useEffect(() => {
    const b = body.current
    if (!b) return
    fighters.set(id, {
      body: b,
      remote: false,
      hitPower: () => (id === 'bot' ? tuning.botPower : 1),
      heading: () => [state.current.headingX, state.current.headingZ],
      isDashing: () => state.current.dashTimer > 0,
      takeHit: (dirX, dirZ, power) => {
        const s = state.current
        s.stun = tuning.hitStun
        s.dashTimer = 0
        s.squash = 1
        const k = tuning.knockback * power
        b.setLinvel({ x: dirX * k, y: tuning.knockUp * power, z: dirZ * k }, true)
      },
    })
    return () => void fighters.delete(id)
  }, [id])

  // Each new round puts the fighter back on its spawn, facing the centre.
  useEffect(() => {
    const b = body.current
    if (!b) return
    const s = state.current
    const len = Math.hypot(spawn[0], spawn[1]) || 1
    Object.assign(s, { dashTimer: 0, cooldown: 0, stun: 0, squash: 0, dead: false })
    s.headingX = -spawn[0] / len
    s.headingZ = -spawn[1] / len
    b.setTranslation({ x: spawn[0], y: REST_Y + 0.5, z: spawn[1] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }, [round, spawn])

  function tryHit(self: RapierRigidBody) {
    const s = state.current
    const p = self.translation()
    for (const [otherId, other] of fighters) {
      if (otherId === id) continue
      const o = other.body.translation()
      const dx = o.x - p.x
      const dz = o.z - p.z
      if (Math.hypot(dx, o.y - p.y, dz) > tuning.hitRange) continue

      // Knock them along a blend of the dash direction and the line between the two bodies.
      const flat = Math.hypot(dx, dz) || 1
      let kx = s.headingX + dx / flat
      let kz = s.headingZ + dz / flat
      const klen = Math.hypot(kx, kz) || 1
      kx /= klen
      kz /= klen

      // Two local fighters dashing into each other both get knocked back. A remote player's
      // own client reports their half of a clash, so it is not applied here.
      const clash = other.isDashing() && !other.remote
      other.takeHit(kx, kz, id === 'bot' ? tuning.botPower : 1)
      if (clash) {
        fighters.get(id)?.takeHit(-kx, -kz, other.hitPower())
      } else {
        s.dashTimer = 0
        self.setLinvel({ x: kx * 2, y: 0, z: kz * 2 }, true)
      }
      s.hitLanded = true
      fx.shake = tuning.shake
      useGame.getState().hitstop(tuning.hitstopMs)
      return
    }
  }

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
    const s = state.current
    const t = tuning
    const p = b.translation()
    const v = b.linvel()

    if (p.y < t.killY) {
      if (!s.dead) {
        s.dead = true
        reportFall(id)
      }
      return
    }

    s.cooldown = Math.max(0, s.cooldown - STEP)

    const intent = getIntent(b)
    let ix = intent.x
    let iz = intent.z
    const len = Math.hypot(ix, iz)
    if (len > 1) {
      ix /= len
      iz /= len
    }
    const steering = len > 0.1
    if (steering && s.dashTimer <= 0) {
      s.headingX = ix / Math.min(len, 1)
      s.headingZ = iz / Math.min(len, 1)
    }

    if (s.stun > 0) {
      s.stun -= STEP
      const drag = Math.max(0, 1 - t.stunDrag * STEP)
      b.setLinvel({ x: v.x * drag, y: v.y, z: v.z * drag }, true)
      return
    }

    if (intent.dash && s.cooldown <= 0 && s.dashTimer <= 0) {
      s.dashTimer = t.dashDuration
      s.cooldown = t.dashCooldown
      s.hitLanded = false
    }

    if (s.dashTimer > 0) {
      s.dashTimer -= STEP
      b.setLinvel({ x: s.headingX * t.dashSpeed, y: Math.max(v.y, 0), z: s.headingZ * t.dashSpeed }, true)
      if (!s.hitLanded) tryHit(b)
      return
    }

    const grounded = Math.abs(p.y - REST_Y) < 0.15
    const control = grounded ? 1 : t.airControl
    const rate = (steering ? t.accel : t.decel) * control * STEP
    b.setLinvel(
      { x: approach(v.x, ix * t.moveSpeed, rate), y: v.y, z: approach(v.z, iz * t.moveSpeed, rate) },
      true,
    )
  })

  const baseColor = useMemo(() => new Color(color), [color])
  useFrame((_, dt) => {
    const s = state.current
    s.squash = Math.max(0, s.squash - dt * 5)
    if (visual.current) poseFighter(visual.current, s.headingX, s.headingZ, s.squash, s.dashTimer > 0)
    // Dimmed while the dash is on cooldown.
    material.current?.color.copy(baseColor).multiplyScalar(s.cooldown > 0 ? 0.45 : 1)
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[spawn[0], REST_Y + 0.5, spawn[1]]}
      enabledRotations={[false, false, false]}
      canSleep={false}
      ccd
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} mass={1} friction={0} restitution={0} />
      <FighterMesh color={color} groupRef={visual} materialRef={material} />
    </RigidBody>
  )
}
