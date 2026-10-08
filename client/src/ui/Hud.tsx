import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { COUNTDOWN_MS, WINS_TO_MATCH } from '@plonko/shared'
import { isMuted, setMuted } from '../audio/sfx'
import { useGame } from '../game/store'
import { netStats, requestRematch } from '../net/net'

function NetStatus() {
  const online = useGame((s) => s.peers.length > 0)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  if (!netStats.connected) return <>Offline · playing the bot</>
  if (!online) return <>Playing the bot until a rival joins · send them the invite link</>
  return (
    <>
      Ping {netStats.ping} ms · {netStats.recvHz} updates/s
    </>
  )
}

function InviteButton() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access needs HTTPS or localhost; fall back to a box the link can be copied from.
      window.prompt('Copy this invite link', location.href)
    }
  }
  return (
    <button onClick={copy}>
      {copied ? 'Link copied' : 'Copy invite link'}
    </button>
  )
}

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted)
  const toggle = () => {
    setMuted(!muted)
    setMutedState(!muted)
  }
  return <button onClick={toggle}>{muted ? 'Sound off' : 'Sound on'}</button>
}

export function Hud() {
  const scores = useGame((s) => s.scores)
  const round = useGame((s) => s.round)
  const banner = useGame((s) => s.banner)
  const match = useGame((s) => s.match)
  const online = useGame((s) => s.peers.length > 0)
  const flashes = useGame((s) => s.flashes)

  return (
    <div className="hud">
      {flashes > 0 && <div key={flashes} className="flash" />}
      <div className="top">
        <div className="score">
          <span>You {scores.me}</span>
          <span className="sep">:</span>
          <span>
            {scores.them} {online ? 'Rival' : 'Bot'}
          </span>
        </div>
        <div className="goal">First to {WINS_TO_MATCH}</div>
      </div>

      {match ? (
        <div className="result">
          <div className="banner">{match === 'won' ? 'You win the match!' : 'You lost the match'}</div>
          <button onClick={requestRematch}>Play again</button>
        </div>
      ) : banner ? (
        <div className="banner">{banner}</div>
      ) : (
        // Remounted every round so the CSS countdown replays.
        <div key={round} className="countdown" style={{ '--countdown': `${COUNTDOWN_MS}ms` } as CSSProperties}>
          <span className="banner ready">Ready…</span>
          <span className="banner go">Go!</span>
        </div>
      )}

      <div className="help">
        <div className="buttons">
          <InviteButton />
          <MuteButton />
        </div>
        <div>WASD / arrows to move · Space to dash</div>
        <div>
          <NetStatus />
        </div>
      </div>
    </div>
  )
}
