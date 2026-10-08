import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, interactionGroups, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import type { Group, MeshStandardMaterial } from 'three'
import { Color } from 'three'
import { sfx } from '../audio/sfx'
import { reportFall } from '../net/net'
import { KO_Y, burst, knockoutEffect } from './effects'
import { FighterMesh } from './FighterMesh'
import { fighters, poseFighter } from './fighters'
import type { Intent } from './fighters'
import { fx, isPlaying, useGame } from './store'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, REST_Y, tuning } from './tuning'

const STEP = 1 / 60
const CONTACT_DIST = CAPSULE_RADIUS * 2
// Fighters collide with the arena only. Contact between fighters is resolved in this file, so the
// same rules apply whether the other fighter is simulated here or is a remote player's proxy.
const FIGHTER_GROUPS = interactionGroups(1, 0)
// How much steering a fighter keeps while reeling from a bump.
const STAGGER_CONTROL = 0.15
const MAX_STAGGER = 0.35

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
    stagger: 0,
    hitLanded: false,
    squash: 0,
    koShown: false,
    dead: false,
  })

  function stagger(speedChange: number) {
    const s = state.current
    if (speedChange < 1.5) return
    s.stagger = Math.max(s.stagger, Math.min(MAX_STAGGER, speedChange * tuning.bumpStagger))
    s.squash = Math.max(s.squash, Math.min(1, speedChange / 10))
  }

  useEffect(() => {
    const b = body.current
    if (!b) return
    fighters.set(id, {
      body: b,
      remote: false,
      hitPower: () => (id === 'bot' ? tuning.botPower : 1),
      heading: () => [state.current.headingX, state.current.headingZ],
      velocity: () => {
        const v = b.linvel()
        return [v.x, v.z]
      },
      isDashing: () => state.current.dashTimer > 0,
      takeHit: (dvx, dvz, up) => {
        const s = state.current
        const v = b.linvel()
        s.stun = tuning.hitStun
        s.dashTimer = 0
        s.squash = 1
        b.setLinvel({ x: v.x + dvx, y: up, z: v.z + dvz }, true)
      },
      push: (dvx, dvz) => {
        const v = b.linvel()
        b.setLinvel({ x: v.x + dvx, y: v.y, z: v.z + dvz }, true)
        stagger(Math.hypot(dvx, dvz))
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
    Object.assign(s, { dashTimer: 0, cooldown: 0, stun: 0, stagger: 0, squash: 0, koShown: false, dead: false })
    s.headingX = -spawn[0] / len
    s.headingZ = -spawn[1] / len
    b.setTranslation({ x: spawn[0], y: REST_Y + 0.5, z: spawn[1] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }, [round, spawn])

  // Body-to-body contact outside a dash: an equal-mass collision along the line between the two
  // fighters, plus a push apart while they overlap. Returns the velocity change for this fighter.
  function bump(self: RapierRigidBody): [number, number] {
    const p = self.translation()
    const v = self.linvel()
    let dvx = 0
    let dvz = 0
    for (const [otherId, other] of fighters) {
      // A dashing fighter's contact is a hit, handled by whoever is dashing.
      if (otherId === id || other.isDashing()) continue
      const o = other.body.translation()
      const nx = p.x - o.x
      const nz = p.z - o.z
      const dist = Math.hypot(nx, nz)
      if (dist >= CONTACT_DIST || dist < 1e-4 || Math.abs(p.y - o.y) > CAPSULE_HALF_HEIGHT * 2 + CAPSULE_RADIUS) continue

      const ux = nx / dist
      const uz = nz / dist
      const ov = other.velocity()
      const closing = -((v.x + dvx - ov[0]) * ux + (v.z + dvz - ov[1]) * uz)
      if (closing > 0) {
        const change = (closing * (1 + tuning.restitution)) / 2
        dvx += ux * change
        dvz += uz * change
        stagger(change)
        if (change > 2) {
          sfx.bump(Math.min(1, change / 6))
          burst({ x: (p.x + o.x) / 2, y: p.y, z: (p.z + o.z) / 2, count: 4, color: '#fde68a', speed: 2.5 })
        }
        other.push(-ux * change, -uz * change)
      }
      const apart = (CONTACT_DIST - dist) * tuning.separation
      dvx += ux * apart
      dvz += uz * apart
    }
    return [dvx, dvz]
  }

  // A dash connecting: the same collision at dash speed, boosted by dashImpact for the one hit.
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

      const vx = s.headingX * tuning.dashSpeed
      const vz = s.headingZ * tuning.dashSpeed
      const ov = other.velocity()
      const closing = Math.max(0, (vx - ov[0]) * kx + (vz - ov[1]) * kz)
      const change = (closing * (1 + tuning.restitution)) / 2
      const power = (id === 'bot' ? tuning.botPower : 1) * tuning.dashImpact

      // Two local fighters dashing into each other both get knocked back. A remote player's
      // own client reports their half of a clash, so it is not applied here.
      const clash = other.isDashing() && !other.remote
      other.takeHit(kx * change * power, kz * change * power, tuning.knockUp * power)
      if (clash) {
        const back = change * other.hitPower() * tuning.dashImpact
        fighters.get(id)?.takeHit(-kx * back - vx, -kz * back - vz, tuning.knockUp)
      } else {
        // The attacker loses the momentum it handed over.
        s.dashTimer = 0
        self.setLinvel({ x: vx - kx * change, y: 0, z: vz - kz * change }, true)
        stagger(change)
      }
      s.hitLanded = true
      const strength = Math.min(1.5, change / 8)
      fx.shake = tuning.shake * strength
      sfx.hit(strength)
      burst({
        x: (p.x + o.x) / 2,
        y: p.y + 0.2,
        z: (p.z + o.z) / 2,
        count: Math.round(8 + 10 * strength),
        color: '#fde68a',
        speed: 4,
        dirX: kx,
        dirZ: kz,
        push: 4 * strength,
        up: 2,
      })
      useGame.getState().hitstop(tuning.hitstopMs * strength)
      return
    }
  }

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
    const s = state.current
    const t = tuning
    const p = b.translation()

    if (p.y < KO_Y && !s.koShown) {
      s.koShown = true
      knockoutEffect(p.x, p.z, color)
    }
    if (p.y < t.killY) {
      if (!s.dead) {
        s.dead = true
        reportFall(id)
      }
      return
    }

    s.cooldown = Math.max(0, s.cooldown - STEP)
    s.stagger = Math.max(0, s.stagger - STEP)

    // Input is read even when ignored, so a dash pressed during the countdown is not saved up.
    const input = getIntent(b)
    const intent = isPlaying() ? input : { x: 0, z: 0, dash: false }
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

    if (intent.dash && s.cooldown <= 0 && s.dashTimer <= 0 && s.stun <= 0) {
      s.dashTimer = t.dashDuration
      s.cooldown = t.dashCooldown
      s.hitLanded = false
      sfx.dash(id === 'me' ? 1 : 0.6)
      burst({ x: p.x, y: p.y - 0.6, z: p.z, count: 8, color, speed: 2, dirX: -s.headingX, dirZ: -s.headingZ, push: 3 })
    }

    if (s.dashTimer > 0) {
      s.dashTimer -= STEP
      b.setLinvel({ x: s.headingX * t.dashSpeed, y: Math.max(b.linvel().y, 0), z: s.headingZ * t.dashSpeed }, true)
      burst({ x: p.x, y: p.y - 0.3, z: p.z, count: 1, color, speed: 0.6, up: 0.3, life: 0.3, size: 0.2 })
      if (!s.hitLanded) tryHit(b)
      return
    }

    const [bx, bz] = bump(b)
    // Read after bump(), so a push from a fighter processed earlier this step is included.
    const v = b.linvel()
    const vx = v.x + bx
    const vz = v.z + bz

    if (s.stun > 0) {
      s.stun -= STEP
      const drag = Math.max(0, 1 - t.stunDrag * STEP)
      b.setLinvel({ x: vx * drag, y: v.y, z: vz * drag }, true)
      return
    }

    const grounded = Math.abs(p.y - REST_Y) < 0.15
    const control = (grounded ? 1 : t.airControl) * (s.stagger > 0 ? STAGGER_CONTROL : 1)
    const rate = (steering ? t.accel : t.decel) * control * STEP
    b.setLinvel(
      { x: approach(vx, ix * t.moveSpeed, rate), y: v.y, z: approach(vz, iz * t.moveSpeed, rate) },
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
      <CapsuleCollider
        args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]}
        mass={1}
        friction={0}
        restitution={0}
        collisionGroups={FIGHTER_GROUPS}
      />
      <FighterMesh color={color} groupRef={visual} materialRef={material} />
    </RigidBody>
  )
}
