import { useEffect } from 'react'
import { useGame } from '../game/store'

export function Hud() {
  const scores = useGame((s) => s.scores)
  const banner = useGame((s) => s.banner)
  const resetScores = useGame((s) => s.resetScores)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'KeyR' && resetScores()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resetScores])

  return (
    <div className="hud">
      <div className="score">
        <span className="you">You {scores.player}</span>
        <span className="sep">:</span>
        <span className="bot">{scores.bot} Bot</span>
      </div>
      {banner && <div className="banner">{banner}</div>}
      <div className="help">WASD / arrows to move · Space to dash · R to reset score</div>
    </div>
  )
}
