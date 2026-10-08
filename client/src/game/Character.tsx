import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Avatar } from '@plonko/shared'
import { AVATARS } from '@plonko/shared'
import type { AnimationAction, Mesh } from 'three'
import { AnimationMixer, LoopOnce, LoopRepeat, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useGame } from './store'

export type Anim = 'idle' | 'run' | 'attack' | 'block' | 'hit' | 'fall' | 'cheer' | 'taunt' | 'wave' | 'defeat'

const MODELS = import.meta.env.BASE_URL + 'models/'
const modelUrl = (avatar: Avatar) => `${MODELS}skeleton-${avatar}.glb`
const ANIMS_URL = `${MODELS}anims.glb`

// What each skeleton carries, by hand. Each also has its own attack clip, named attack-<avatar>.
type Weapon = 'blade' | 'axe' | 'staff' | 'shield'
const LOADOUT: Record<Avatar, { right: Weapon; left?: Weapon }> = {
  warrior: { right: 'blade', left: 'shield' },
  rogue: { right: 'blade', left: 'blade' },
  mage: { right: 'staff' },
  minion: { right: 'axe' },
}
const weaponUrl = (weapon: Weapon) => `${MODELS}weapon-${weapon}.glb`
// How long fighters hold the attack animation: the strike plus its follow-through.
export const ATTACK_ANIM_S = 0.55
// The attack clips open with a slow wind-up. Each starts this far in (seconds), so the strike,
// where the weapon hand moves fastest, lands about 0.13 s after the dash begins.
const ATTACK_START: Record<Avatar, number> = { warrior: 0.28, rogue: 0.41, mage: 0.24, minion: 0.44 }
const ATTACK_FADE = 0.05

// The models stand about 2.2 units tall; this brings them down to the physics capsule's height.
const SCALE = 0.78
const FADE = 0.12
// Clips that play once and hold their last frame, and how fast each clip plays.
const ONCE = ['attack', 'hit', 'defeat']
const SPEED: Partial<Record<Anim, number>> = { run: 1.3, attack: 1.15 }
// The cloth on each skeleton, which is recoloured to the player's colour.
const CLOTH = /_(Cloak|Cape|Hat)$/

type Props = { avatar: Avatar; color: string; getAnim: () => Anim }

// A KayKit skeleton, animated from the shared clip file. Purely visual: physics uses the capsule.
export function Character({ avatar, color, getAnim }: Props) {
  const { scene } = useGLTF(modelUrl(avatar))
  const { animations } = useGLTF(ANIMS_URL)
  const { right, left } = LOADOUT[avatar]
  const rightHand = useGLTF(weaponUrl(right)).scene
  // A hook cannot be skipped, so one-handed skeletons load their own weapon twice and ignore the second.
  const leftHand = useGLTF(weaponUrl(left ?? right)).scene

  // Skinned models cannot be shared between fighters, so each one gets its own copy.
  const model = useMemo(() => {
    const copy = clone(scene)
    const cloth = new MeshStandardMaterial({ color, roughness: 0.8 })
    const eyes = new MeshBasicMaterial({ color, toneMapped: false })
    copy.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      // Animated limbs move outside the rest-pose bounds, which would otherwise get them culled.
      mesh.frustumCulled = false
      if (CLOTH.test(mesh.name)) mesh.material = cloth
      else if (mesh.name.endsWith('_Eyes')) mesh.material = eyes
    })
    // The rig has an empty bone in each palm for held items. The loader strips the dot from "handslot.r".
    const hold = (bone: string, weapon: typeof rightHand) => {
      const held = weapon.clone()
      held.traverse((o) => void (o.castShadow = true))
      copy.getObjectByName(bone)?.add(held)
    }
    hold('handslotr', rightHand)
    if (left) hold('handslotl', leftHand)
    return copy
  }, [scene, color, rightHand, leftHand, left])

  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const actions = useMemo(() => {
    const map = new Map<string, AnimationAction>()
    for (const clip of animations) {
      const action = mixer.clipAction(clip)
      const once = ONCE.includes(clip.name.split('-')[0])
      action.setLoop(once ? LoopOnce : LoopRepeat, Infinity)
      action.clampWhenFinished = once
      map.set(clip.name, action)
    }
    return map
  }, [animations, mixer])

  const current = useRef<AnimationAction | null>(null)
  useEffect(() => {
    current.current = null
    return () => void mixer.stopAllAction()
  }, [mixer])

  useFrame((_, dt) => {
    const name = getAnim()
    const next = actions.get(name === 'attack' ? `attack-${avatar}` : name)
    if (next && next !== current.current) {
      const attacking = name === 'attack'
      const fade = attacking ? ATTACK_FADE : FADE
      current.current?.fadeOut(fade)
      next.reset().setEffectiveTimeScale(SPEED[name] ?? 1).fadeIn(fade).play()
      if (attacking) next.time = ATTACK_START[avatar]
      current.current = next
    }
    // Hold the pose during a hit-pause or a solo pause, like the physics does.
    const g = useGame.getState()
    if (!g.frozen && !(g.menuOpen && g.mode === 'solo')) mixer.update(dt)
  })

  return <primitive object={model} scale={SCALE} />
}

useGLTF.preload(ANIMS_URL)
for (const avatar of AVATARS) useGLTF.preload(modelUrl(avatar))
for (const weapon of ['blade', 'axe', 'staff', 'shield'] as const) useGLTF.preload(weaponUrl(weapon))
