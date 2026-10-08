import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, interactionGroups, useBeforePhysicsStep } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { EMOTES, POWER_BITS } from '@plonko/shared'
import type { Avatar } from '@plonko/shared'
import type { Group, MeshBasicMaterial } from 'three'
import { Color } from 'three'
import { sfx } from '../audio/sfx'
import { claimItem, reportFall } from '../net/net'
import { KO_Y, burst, knockoutEffect } from './effects'
import { ATTACK_ANIM_S } from './Character'
import type { Anim } from './Character'
import { FighterMesh } from './FighterMesh'
import { fighters, poseFighter } from './fighters'
import { hazardStrike } from './hazards'
import { POWER_COLORS, POWER_SECONDS, itemAt } from './powerups'
import type { Intent } from './fighters'
import { BOT_TIERS } from './bot'
import { recordHit, recordItem } from './stats'
import { currentStage, fx, isPlaying, useGame } from './store'
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, REST_Y, tuning } from './tuning'

const STEP = 1 / 60
const CONTACT_DIST = CAPSULE_RADIUS * 2
// Fighters collide with the arena only. Contact between fighters is resolved in this file, so the
// same rules apply whether the other fighter is simulated here or is a remote player's proxy.
const FIGHTER_GROUPS = interactionGroups(1, 0)
// A block covers the front and sides: it fails only against a hit from behind. This is the lowest
// value of facing-dot-direction-to-attacker that still counts as covered.
const BLOCK_ARC = -0.3
// A guard this empty cannot be raised again until it has refilled a little.
const GUARD_MIN = 0.25
const RECOIL_STUN = 0.3
// How much steering a fighter keeps while reeling from a bump.
const STAGGER_CONTROL = 0.15
const MAX_STAGGER = 0.35
const MAX_DAMAGE = 200
// A blocked hit still chips a little damage.
const BLOCK_DAMAGE = 4
// While heavy a fighter takes half the knockback and deals a third more.
const HEAVY_TAKEN = 0.5
const HEAVY_DEALT = 1.3
// While quick the dash recharges in under half the time.
const QUICK_COOLDOWN = 0.4
const EMOTE_SECONDS = 1.6
const SHOCK_RADIUS = 4.5
const SHOCK_SPEED = 14

// Multiplier on the knockback a fighter deals. The bot hits harder on the tougher tiers.
const hitPowerOf = (id: 'me' | 'bot') =>
  id === 'bot' ? Math.min(1.1, tuning.botPower * BOT_TIERS[currentStage().tier].power) : 1

// The shock power-up: everyone near the fighter who set it off is blasted directly away.
function shockwave(id: string, p: { x: number; y: number; z: number } | undefined) {
  if (!p) return
  for (const [otherId, other] of fighters) {
    const o = other.body?.translation()
    if (otherId === id || !o) continue
    const dx = o.x - p.x
    const dz = o.z - p.z
    const dist = Math.hypot(dx, dz)
    if (dist > SHOCK_RADIUS || dist < 1e-3) continue
    other.takeHit((dx / dist) * SHOCK_SPEED, (dz / dist) * SHOCK_SPEED, 6)
  }
  sfx.shockwave()
  fx.shake = 0.8
  burst({ x: p.x, y: p.y - 0.4, z: p.z, count: 48, color: POWER_COLORS.shock, speed: 9, up: 0.6, life: 0.6, size: 0.2 })
}

const approach = (current: number, target: number, maxDelta: number) =>
  current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target)

type Props = {
  id: 'me' | 'bot'
  avatar: Avatar
  color: string
  spawn: [number, number]
  name?: string
  getIntent: (self: RapierRigidBody) => Intent
}

export function Fighter({ id, avatar, color, spawn, name, getIntent }: Props) {
  // Read as plain numbers, so a re-render that passes an equal spawn in a new array changes nothing.
  const [spawnX, spawnZ] = spawn
  const startPosition = useMemo<[number, number, number]>(() => [spawnX, REST_Y + 0.5, spawnZ], [spawnX, spawnZ])
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const round = useGame((s) => s.round)

  const state = useRef({
    headingX: 0,
    headingZ: 1,
    dashTimer: 0,
    // Counts down from the start of a dash; the weapon swing outlasts the dash itself.
    attack: 0,
    cooldown: 0,
    stun: 0,
    stagger: 0,
    hitLanded: false,
    blocking: false,
    // Set when the guard runs out. The block key must be let go before it will work again, so a
    // held key cannot flicker the block on and off as the guard trickles back.
    guardBroken: false,
    // How much block is left, 1 full to 0 empty. Drains while blocking and refills otherwise.
    guard: 1,
    // Damage taken this round, in per cent. It makes every later knock stronger.
    damage: 0,
    // Seconds left on each timed power-up.
    heavy: 0,
    quick: 0,
    // The emote being played (an index into EMOTES plus one, 0 for none) and the seconds left of it.
    emote: 0,
    emoteTimer: 0,
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

  // How much harder than normal a knock sends this fighter, from its damage and power-ups.
  function knockTaken() {
    const s = state.current
    return (1 + (s.damage / 100) * tuning.damageScale) * (s.heavy > 0 ? HEAVY_TAKEN : 1)
  }

  useEffect(() => {
    fighters.set(id, {
      get body() {
        return body.current
      },
      remote: false,
      hitPower: () => hitPowerOf(id),
      heading: () => [state.current.headingX, state.current.headingZ],
      velocity: () => {
        const v = body.current?.linvel()
        return v ? [v.x, v.z] : [0, 0]
      },
      isDashing: () => state.current.dashTimer > 0,
      isBlocking: () => state.current.blocking,
      emote: () => state.current.emote,
      damage: () => state.current.damage,
      powers: () => ({ heavy: state.current.heavy, quick: state.current.quick }),
      grant: (kind) => {
        const s = state.current
        const p = body.current?.translation()
        sfx.pickup()
        recordItem(id)
        if (p) burst({ x: p.x, y: p.y, z: p.z, count: 16, color: POWER_COLORS[kind], speed: 3, up: 3, life: 0.5 })
        if (kind === 'shock') shockwave(id, p)
        else s[kind] = POWER_SECONDS[kind]
      },
      takeHit: (dvx, dvz, up) => {
        const s = state.current
        const b = body.current
        if (!b) return false
        const v = b.linvel()
        // The blow travels along (dvx, dvz), so the attacker stands in the opposite direction.
        const facingAttacker = -(s.headingX * dvx + s.headingZ * dvz) / (Math.hypot(dvx, dvz) || 1)
        if (s.blocking && facingAttacker > BLOCK_ARC) {
          const p = b.translation()
          s.guard = Math.max(0, s.guard - tuning.guardCost)
          s.damage = Math.min(MAX_DAMAGE, s.damage + BLOCK_DAMAGE)
          s.squash = 0.4
          b.setLinvel({ x: v.x + dvx * tuning.blockKnock, y: v.y, z: v.z + dvz * tuning.blockKnock }, true)
          sfx.block()
          burst({ x: p.x, y: p.y + 0.2, z: p.z, count: 12, color: '#dff4ff', speed: 5, up: 1.5, life: 0.3 })
          return true
        }
        // The knock is scaled by the damage already taken, then this hit adds to it.
        const k = knockTaken()
        s.damage = Math.min(MAX_DAMAGE, s.damage + tuning.hitDamage)
        s.stun = tuning.hitStun
        s.dashTimer = 0
        s.blocking = false
        s.emote = 0
        s.squash = 1
        b.setLinvel({ x: v.x + dvx * k, y: up * (1 + (k - 1) * 0.3), z: v.z + dvz * k }, true)
        return false
      },
      recoil: (dvx, dvz) => {
        const s = state.current
        s.stun = RECOIL_STUN
        s.dashTimer = 0
        s.squash = 0.7
        body.current?.setLinvel({ x: dvx, y: 2, z: dvz }, true)
      },
      push: (dvx, dvz) => {
        const b = body.current
        if (!b) return
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
    const len = Math.hypot(spawnX, spawnZ) || 1
    Object.assign(s, { blocking: false, guardBroken: false, guard: 1, damage: 0, heavy: 0, quick: 0, emote: 0, dashTimer: 0, attack: 0, cooldown: 0, stun: 0, stagger: 0, squash: 0, koShown: false, dead: false })
    s.headingX = -spawnX / len
    s.headingZ = -spawnZ / len
    b.setTranslation({ x: spawnX, y: REST_Y + 0.5, z: spawnZ }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }, [round, spawnX, spawnZ])

  // Body-to-body contact outside a dash: an equal-mass collision along the line between the two
  // fighters, plus a push apart while they overlap. Returns the velocity change for this fighter.
  function bump(self: RapierRigidBody): [number, number] {
    const p = self.translation()
    const v = self.linvel()
    let dvx = 0
    let dvz = 0
    for (const [otherId, other] of fighters) {
      // A dashing fighter's contact is a hit, handled by whoever is dashing.
      if (otherId === id || other.isDashing() || !other.body) continue
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
      if (otherId === id || !other.body) continue
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
      const power = hitPowerOf(id) * tuning.dashImpact * (s.heavy > 0 ? HEAVY_DEALT : 1)

      // Two local fighters dashing into each other both get knocked back. A remote player's
      // own client reports their half of a clash, so it is not applied here.
      const clash = other.isDashing() && !other.remote
      const blocked = other.takeHit(kx * change * power, kz * change * power, tuning.knockUp * power)
      recordHit(id, otherId, blocked)
      if (blocked) {
        // Caught on their guard: most of the blow comes straight back.
        fighters.get(id)?.recoil(-kx * change * power * tuning.blockRecoil, -kz * change * power * tuning.blockRecoil)
      } else if (clash) {
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
      useGame.getState().hitstop(tuning.hitstopMs * strength)
      // A blocked hit has already made its own clang and sparks.
      if (blocked) return
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
    s.attack = Math.max(0, s.attack - STEP)
    s.heavy = Math.max(0, s.heavy - STEP)
    s.quick = Math.max(0, s.quick - STEP)

    // A stage hazard takes over the fighter's movement for a moment, like a hit that cannot be blocked.
    const strike = hazardStrike(id, p, b.linvel())
    if (strike) {
      const k = knockTaken()
      s.damage = Math.min(MAX_DAMAGE, s.damage + strike.damage)
      s.stun = strike.stun
      s.dashTimer = 0
      s.blocking = false
      s.emote = 0
      s.squash = 1
      b.setLinvel({ x: strike.vx * k, y: strike.up, z: strike.vz * k }, true)
      if (strike.kind === 'bumper') sfx.bumper()
      else if (strike.kind === 'spikes') sfx.spikes()
      else sfx.hit(0.8)
      burst({ x: p.x, y: p.y, z: p.z, count: 12, color: '#fde68a', speed: 4, up: 2 })
      if (id === 'me') fx.shake = tuning.shake
      return
    }

    const item = itemAt(p.x, p.z)
    if (item && p.y > REST_Y - 0.3) claimItem(id, item)

    // Input is read even when ignored, so a dash pressed during the countdown is not saved up.
    const input = getIntent(b)
    const intent = isPlaying() ? input : { x: 0, z: 0, dash: false, block: false, jump: false, emote: 0 }
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

    // Blocking plants the feet: no moving or dashing, though the fighter can still turn to face a threat.
    const grounded = Math.abs(p.y - REST_Y) < 0.15
    if (!intent.block) s.guardBroken = false
    const ready = !s.guardBroken && s.guard > (s.blocking ? 0 : GUARD_MIN)
    s.blocking = intent.block && ready && grounded && s.stun <= 0 && s.dashTimer <= 0
    s.guard = Math.min(1, Math.max(0, s.guard + (s.blocking ? -STEP / t.guardTime : STEP / t.guardRecharge)))
    if (s.guard <= 0) s.guardBroken = true
    if (s.blocking) {
      ix = 0
      iz = 0
    }

    // An emote plays for a moment while standing about. Moving off, dashing or being hit cuts it short.
    s.emoteTimer = Math.max(0, s.emoteTimer - STEP)
    if (s.emoteTimer <= 0 || steering || s.blocking) s.emote = 0
    if (input.emote > 0 && !steering && grounded && !s.blocking && s.stun <= 0 && s.dashTimer <= 0) {
      s.emote = input.emote
      s.emoteTimer = EMOTE_SECONDS
      sfx.emote()
    }

    // A jump clears a dash aimed at the feet, and the sweeper.
    if (intent.jump && grounded && !s.blocking && s.stun <= 0) {
      const v0 = b.linvel()
      b.setLinvel({ x: v0.x, y: t.jumpSpeed, z: v0.z }, true)
      sfx.jump()
      burst({ x: p.x, y: p.y - 0.7, z: p.z, count: 6, color: '#e5e7eb', speed: 2, up: 0.4, life: 0.3 })
    }

    if (intent.dash && !s.blocking && s.cooldown <= 0 && s.dashTimer <= 0 && s.stun <= 0) {
      s.dashTimer = t.dashDuration
      s.cooldown = t.dashCooldown * (s.quick > 0 ? QUICK_COOLDOWN : 1)
      s.attack = ATTACK_ANIM_S
      s.emote = 0
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

    const control = (grounded ? 1 : t.airControl) * (s.stagger > 0 ? STAGGER_CONTROL : 1)
    // On a slippery stage fighters take longer to get going and to stop. A blocker digs in and stops hard.
    const pace = s.blocking ? t.decel * 2 : steering ? t.accel : t.decel
    const rate = pace * control * currentStage().grip * STEP
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
    // The ring at the fighter's feet dims while the dash recharges.
    ring.current?.color.copy(baseColor).multiplyScalar(s.cooldown > 0 ? 0.35 : 1)
  })

  // Which animation the model should be playing, from what the fighter is doing right now.
  function getAnim(): Anim {
    const b = body.current
    if (!b) return 'idle'
    const s = state.current
    const g = useGame.getState()
    if (b.translation().y < REST_Y - 0.5) return 'fall'
    if (s.stun > 0) return 'hit'
    if (s.attack > 0) return 'attack'
    if (s.blocking) return 'block'
    if (b.translation().y > REST_Y + 0.3) return 'fall'
    if (s.emote > 0) return EMOTES[s.emote - 1]
    // "won" and "Knockout!" are from the local player's side, so the bot reacts the opposite way.
    const mine = id === 'me'
    if (g.match) return (g.match === 'won') === mine ? 'cheer' : 'defeat'
    if (g.banner) return (g.banner === 'Knockout!') === mine ? 'taunt' : 'idle'
    const v = b.linvel()
    return Math.hypot(v.x, v.z) > 1 ? 'run' : 'idle'
  }

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={startPosition}
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
      <FighterMesh
        avatar={avatar}
        color={color}
        getAnim={getAnim}
        getGuard={() => (state.current.blocking ? state.current.guard : 0)}
        getPowers={() => (state.current.heavy > 0 ? POWER_BITS.heavy : 0) | (state.current.quick > 0 ? POWER_BITS.quick : 0)}
        name={name}
        groupRef={visual}
        ringRef={ring}
      />
    </RigidBody>
  )
}
