import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { COUNTDOWN_MS, WINS_TO_MATCH } from '@plonko/shared'
import { useSettings } from '../game/settings'
import { useGame } from '../game/store'
import { netStats, requestRematch } from '../net/net'
import { Landing } from './Landing'
import { Menu } from './Menu'

// Connection figures live outside React, so components showing them re-render on a timer.
function useNetTick() {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])
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
  return <button onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</button>
}

// Shown in a room of one, in place of the round countdown.
function Waiting() {
  useNetTick()
  const mainMenu = () => location.assign(location.pathname)

  if (netStats.full) {
    return (
      <div className="panel">
        <strong>This room is full</strong>
        <span>Two players are already in it.</span>
        <button onClick={mainMenu}>Back to main menu</button>
      </div>
    )
  }
  return (
    <div className="panel">
      <strong>Waiting for a rival</strong>
      {netStats.connected ? (
        <>
          <span>Send this link to a friend. The match starts when they open it.</span>
          <code>{location.href}</code>
          <InviteButton />
          <span>You can move around while you wait.</span>
        </>
      ) : (
        <span>Connecting to the server…</span>
      )}
    </div>
  )
}

// Shown when the other player leaves. Nothing can be played until the player chooses.
function RivalLeft() {
  return (
    <div className="panel">
      <strong>Your rival left the room</strong>
      <span>The match is over. You can wait here for them to come back, or leave.</span>
      <div className="panel-actions">
        <button className="primary" onClick={() => useGame.setState({ rivalLeft: false })}>
          Wait for a player
        </button>
        <button onClick={() => location.assign(location.pathname)}>Main menu</button>
      </div>
    </div>
  )
}

function Ping() {
  useNetTick()
  return (
    <div>
      Ping {netStats.ping} ms · {netStats.recvHz} updates/s
    </div>
  )
}

export function Hud() {
  const mode = useGame((s) => s.mode)
  const scores = useGame((s) => s.scores)
  const round = useGame((s) => s.round)
  const banner = useGame((s) => s.banner)
  const match = useGame((s) => s.match)
  const hasRival = useGame((s) => s.peers.length > 0)
  const flashes = useGame((s) => s.flashes)
  const rivalLeft = useGame((s) => s.rivalLeft)
  const flashOn = useSettings((s) => s.flash)
  const showPing = useSettings((s) => s.showNetStats)
  const paused = useGame((s) => s.menuOpen && s.mode === 'solo')

  if (mode === 'landing') {
    return (
      <div className="hud">
        <Landing />
        <Menu />
      </div>
    )
  }

  const waiting = mode === 'online' && !hasRival

  return (
    <div className="hud">
      {flashOn && flashes > 0 && <div key={flashes} className="flash" />}
      <Menu />
      <div className="top">
        {!waiting && (
          <>
            <div className="score">
              <span>You {scores.me}</span>
              <span className="sep">:</span>
              <span>
                {scores.them} {mode === 'online' ? 'Rival' : 'Bot'}
              </span>
            </div>
            <div className="goal">First to {WINS_TO_MATCH}</div>
          </>
        )}
      </div>

      {waiting && rivalLeft ? (
        <RivalLeft />
      ) : waiting ? (
        <Waiting />
      ) : match ? (
        <div className="result">
          <div className="banner">{match === 'won' ? 'You win the match!' : 'You lost the match'}</div>
          <button onClick={requestRematch}>Play again</button>
        </div>
      ) : banner ? (
        <div className="banner">{banner}</div>
      ) : (
        // Remounted every round so the CSS countdown replays.
        <div
          key={round}
          className={paused ? 'countdown paused' : 'countdown'}
          style={{ '--countdown': `${COUNTDOWN_MS}ms` } as CSSProperties}
        >
          <span className="banner ready">Ready…</span>
          <span className="banner go">Go!</span>
        </div>
      )}

      <div className="help">
        <div>WASD / arrows to move · Space to dash · Esc for menu</div>
        {mode === 'online' && hasRival && showPing && <Ping />}
      </div>
    </div>
  )
}
