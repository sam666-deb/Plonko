import { Suspense, useEffect, useMemo } from 'react'
import { stageById } from '@plonko/shared'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { keyboardIntent } from '../input/keyboard'
import { botIntent } from './bot'
import { Fighter } from './Fighter'
import { FloorItems } from './FloorItems'
import { Ledges } from './Ledges'
import { TILE } from './floor'
import { Particles } from './Particles'
import { Platform } from './Platform'
import { RemoteFighter } from './RemoteFighter'
import { Scenery } from './Scenery'
import { StageHazards } from './StageHazards'
import { useSettings } from './settings'
import { fx, sideOf, useGame } from './store'
import { inBackground } from './ticker'
import { useTuning } from './tuning'

const CAMERA_POS: [number, number, number] = [0, 15, 12]
const COLORS = ['#38bdf8', '#f87171']

// Fixed overview camera behind the local player's side; only moves to shake on a hit.
// Behind the landing page it circles the arena slowly instead.
function CameraRig() {
  const side = useGame((s) => sideOf(s.slot))
  const landing = useGame((s) => s.mode === 'landing')
  useFrame(({ camera, clock }, dt) => {
    if (landing) {
      const angle = clock.elapsedTime * 0.12
      camera.position.set(Math.sin(angle) * 14, 10, Math.cos(angle) * 14)
      camera.lookAt(0, 0, 0)
      return
    }
    fx.shake = Math.max(0, fx.shake - dt * 3)
    const shake = fx.shake * useSettings.getState().shake
    camera.position.set(
      CAMERA_POS[0] + (Math.random() - 0.5) * shake,
      CAMERA_POS[1] + (Math.random() - 0.5) * shake,
      CAMERA_POS[2] * side,
    )
    camera.lookAt(0, 0, 0)
  })
  return null
}

// Draws the scene, except while the page is hidden: the game keeps simulating there so the
// player does not freeze for their opponent, but nobody can see it, so drawing is skipped.
function Renderer() {
  useFrame(({ gl, scene, camera }) => {
    if (!inBackground()) gl.render(scene, camera)
  }, 1)
  return null
}

export function Game() {
  const t = useTuning()
  const stage = stageById(useGame((s) => s.stage))
  const { theme } = stage
  // Kept stable between renders: fighters go back to their spawn whenever it changes.
  const spawns = useMemo(() => stage.spawns.map(([x, z]) => [x * TILE, z * TILE] as [number, number]), [stage])

  // The page background is the sky behind the transparent canvas, so it follows the stage too.
  useEffect(() => {
    theme.sky.forEach((color, i) => document.documentElement.style.setProperty(`--sky-${i}`, color))
  }, [theme])
  const frozen = useGame((s) => s.frozen)
  const slot = useGame((s) => s.slot)
  const peers = useGame((s) => s.peers)
  const shadows = useSettings((s) => s.shadows)
  const avatar = useSettings((s) => s.avatar)
  const myName = useSettings((s) => s.name) || 'You'
  // The bot never wears the same skeleton as the player.
  const botAvatar = avatar === 'minion' ? 'warrior' : 'minion'
  const mode = useGame((s) => s.mode)
  // Name tags stay off the landing page, where the fighters are only a backdrop.
  const tags = mode !== 'landing'
  // The menu pauses the game only against the bot; an online match cannot stop for one player.
  const paused = useGame((s) => s.menuOpen && s.mode === 'solo')

  return (
    <Canvas shadows camera={{ position: CAMERA_POS, fov: 42 }}>
      {/* Distant things fade into the dark, so tiles and fighters vanish as they fall into the pit. */}
      <fog attach="fog" args={[theme.fog, 27, 50]} />
      <ambientLight intensity={0.55} color={theme.ambient} />
      <directionalLight position={[6, 14, 6]} intensity={1.5} color="#fff1dc" castShadow={shadows} shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, 40]} />
      </directionalLight>
      <CameraRig />
      <Renderer />
      <Particles />
      <StageHazards stage={stage} />
      <FloorItems />
      <Suspense fallback={null}>
        <Scenery theme={theme} />
        <Ledges theme={theme} />
      </Suspense>
      <Physics gravity={[0, -t.gravity, 0]} paused={frozen || paused}>
        <Platform key={stage.id} stage={stage} />
        <Fighter
          id="me"
          avatar={avatar}
          color={COLORS[slot]}
          spawn={spawns[slot]}
          name={tags ? myName : undefined}
          getIntent={keyboardIntent}
        />
        {/* The bot is the solo opponent, and stands on the arena behind the landing page. */}
        {mode !== 'online' ? (
          <Fighter
            id="bot"
            avatar={botAvatar}
            color={COLORS[1]}
            spawn={spawns[1]}
            name={tags ? 'Bot' : undefined}
            getIntent={botIntent}
          />
        ) : (
          peers.map((p) => (
            <RemoteFighter key={p.id} id={p.id} avatar={p.avatar} color={COLORS[p.slot]} spawn={spawns[p.slot]} name={p.name} />
          ))
        )}
      </Physics>
    </Canvas>
  )
}
