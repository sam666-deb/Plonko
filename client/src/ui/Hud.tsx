import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { netStats } from '../net/net'

function NetStatus() {
  const online = useGame((s) => s.peers.length > 0)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  if (!netStats.connected) return <>No server · playing the bot</>
  if (!online) return <>Room “{netStats.room}” · waiting for a player · ping {netStats.ping} ms</>
  return (
    <>
      Room “{netStats.room}” · ping {netStats.ping} ms · {netStats.recvHz} updates/s
    </>
  )
}

export function Hud() {
  const scores = useGame((s) => s.scores)
  const banner = useGame((s) => s.banner)
  const online = useGame((s) => s.peers.length > 0)
  const resetScores = useGame((s) => s.resetScores)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'KeyR' && resetScores()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resetScores])

  return (
    <div className="hud">
      <div className="score">
        <span>You {scores.me}</span>
        <span className="sep">:</span>
        <span>
          {scores.them} {online ? 'Rival' : 'Bot'}
        </span>
      </div>
      {banner && <div className="banner">{banner}</div>}
      <div className="help">
        <div>WASD / arrows to move · Space to dash{online ? '' : ' · R to reset score'}</div>
        <div>
          <NetStatus />
        </div>
      </div>
    </div>
  )
}
