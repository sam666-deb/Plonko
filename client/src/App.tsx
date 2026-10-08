import { Leva } from 'leva'
import { Game } from './game/Game'
import { Hud } from './ui/Hud'

export default function App() {
  return (
    <>
      {/* The tuning panel is a development tool; players all get the same built-in values. */}
      <Leva hidden={!import.meta.env.DEV} />
      <Game />
      <Hud />
    </>
  )
}
