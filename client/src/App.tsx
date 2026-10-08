import { useEffect, useState } from 'react'
import { Leva } from 'leva'
import { Game } from './game/Game'
import { Hud } from './ui/Hud'

export default function App() {
  // The tuning panel is a development tool: hidden until ` is pressed, and never available in the built game.
  const [tuning, setTuning] = useState(false)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e: KeyboardEvent) => e.code === 'Backquote' && setTuning((on) => !on)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Leva hidden={!tuning} />
      <Game />
      <Hud />
    </>
  )
}
