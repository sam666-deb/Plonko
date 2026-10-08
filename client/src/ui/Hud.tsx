import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CAMPAIGN, CAMPAIGN_WINS, COUNTDOWN_MS, WINS_TO_MATCH, stageById } from '@plonko/shared'
import { fighters } from '../game/fighters'
import { useSettings } from '../game/settings'
import { stats } from '../game/stats'
import { useGame } from '../game/store'
import { EMBEDDED, netStats, requestRematch, roomCode } from '../net/net'
import { Landing } from './Landing'
import { Stars } from './Levels'
import { Menu } from './Menu'
import { StagePreview } from './StagePreview'
import { TouchControls } from './TouchControls'
import { useTouchDevice } from './useTouchDevice'
import { setTrack } from '../audio/music'

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
          <span>Give your friend this room code. The match starts when they join.</span>
          <code className="room-code">{roomCode().toUpperCase()}</code>
          {/* Framed inside another site, this page's address is not one a friend could open. */}
          {!EMBEDDED && (
            <>
              <span>Or send them the link:</span>
              <InviteButton />
            </>
          )}
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

const damageLevel = (damage: number) => (damage >= 100 ? 'high' : damage >= 50 ? 'mid' : 'low')

// Each fighter's damage and the local player's active power-ups. These change every frame and
// live outside React, so this re-reads them ten times a second.
function Status({ myName, rivalName }: { myName: string; rivalName: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(timer)
  }, [])

  const me = fighters.get('me')
  const rival = [...fighters].find(([id]) => id !== 'me')?.[1]
  if (!me) return null
  const mine = Math.round(me.damage())
  const theirs = Math.round(rival?.damage() ?? 0)
  const powers = me.powers()
  return (
    <div className="status">
      <span className={`damage ${damageLevel(mine)}`}>
        {myName} {mine}%
      </span>
      {powers.heavy > 0 && <span className="power heavy">Heavy {Math.ceil(powers.heavy)}s</span>}
      {powers.quick > 0 && <span className="power quick">Quick dash {Math.ceil(powers.quick)}s</span>}
      <span className={`damage ${damageLevel(theirs)}`}>
        {rivalName} {theirs}%
      </span>
    </div>
  )
}

// The end-of-match table. The figures are read once, when the match ends.
function Summary({ myName, rivalName, scores }: { myName: string; rivalName: string; scores: { me: number; them: number } }) {
  const [seconds] = useState(() => Math.round((performance.now() - stats.startedAt) / 1000))
  const rows: [string, number, number][] = [
    ['Knockouts', scores.me, scores.them],
    ['Hits landed', stats.me.hits, stats.them.hits],
    ['Hits blocked', stats.me.blocks, stats.them.blocks],
    ['Power-ups', stats.me.items, stats.them.items],
  ]
  return (
    <div className="summary">
      <table>
        <thead>
          <tr>
            <th />
            <th>{myName}</th>
            <th>{rivalName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, mine, theirs]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className={mine > theirs ? 'best' : ''}>{mine}</td>
              <td className={theirs > mine ? 'best' : ''}>{theirs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="length">
        Match length {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
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
  const level = useGame((s) => s.level)
  const stage = stageById(useGame((s) => s.stage))
  const flashOn = useSettings((s) => s.flash)
  const showPing = useSettings((s) => s.showNetStats)
  const paused = useGame((s) => s.menuOpen && s.mode === 'solo')
  const isTouch = useTouchDevice()
  const myName = useSettings((s) => s.name) || 'You'
  const campaign = useGame((s) => s.campaign)
  const savedStars = useSettings((s) => s.campaignStars)
  const startCampaign = useGame((s) => s.startCampaign)
  const toLevels = useGame((s) => s.toLevels)
  // A campaign level is named by its place in the campaign; a match by the round it has reached.
  const levelLabel = campaign === null ? `Level ${level}` : `Campaign ${campaign + 1}`
  const wins = campaign === null ? WINS_TO_MATCH : CAMPAIGN_WINS
  const rivalName = useGame((s) => (s.mode === 'online' ? (s.peers[0]?.name ?? 'Rival') : 'Bot'))

  // Leaving the landing page drops keyboard focus from its name box and buttons, so the game keys work at once.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [mode])

  // The music follows the game: a calm loop on the landing page, then the stage's tier.
  useEffect(() => setTrack(mode === 'landing' ? 'menu' : stage.tier), [mode, stage.tier])

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
      {flashOn && flashes > 0 && <div key={`flash-${flashes}`} className="flash" />}
      <Menu />
      <div className="top">
        {!waiting && (
          <>
            <div className="score">
              <span>
                {myName} {scores.me}
              </span>
              <span className="sep">:</span>
              <span>
                {scores.them} {rivalName}
              </span>
            </div>
            <div className="goal">
              First to {wins} · {levelLabel} · <span className={`tier ${stage.tier}`}>{stage.tier}</span>
            </div>
            <Status myName={myName} rivalName={rivalName} />
          </>
        )}
      </div>

      {waiting && rivalLeft ? (
        <RivalLeft />
      ) : waiting ? (
        <Waiting />
      ) : match ? (
        campaign === null ? (
          <div className="result">
            <div className="banner">{match === 'won' ? 'You win the match!' : 'You lost the match'}</div>
            <Summary myName={myName} rivalName={rivalName} scores={scores} />
            <button onClick={requestRematch}>Play again</button>
          </div>
        ) : (
          <div className="result">
            <div className="banner">
              {match === 'lost'
                ? `Level ${campaign + 1} failed`
                : campaign + 1 === CAMPAIGN.length
                  ? 'Campaign complete!'
                  : `Level ${campaign + 1} complete!`}
            </div>
            {/* Three stars for a clean win, one fewer for each round dropped. */}
            {match === 'won' && <Stars count={Math.max(1, 3 - scores.them)} />}
            <Summary myName={myName} rivalName={rivalName} scores={scores} />
            {match === 'won' && (savedStars[campaign] ?? 0) > Math.max(1, 3 - scores.them) && (
              <div className="best">Your best here is {savedStars[campaign]} stars</div>
            )}
            <div className="panel-actions">
              {match === 'won' && campaign + 1 < CAMPAIGN.length && (
                <button className="next" onClick={() => startCampaign(campaign + 1)}>
                  Next level
                </button>
              )}
              <button className={match === 'lost' ? 'next' : ''} onClick={requestRematch}>
                {match === 'won' ? 'Replay' : 'Try again'}
              </button>
              <button onClick={toLevels}>Levels</button>
            </div>
          </div>
        )
      ) : banner ? (
        <div className="banner">{banner}</div>
      ) : (
        // Remounted every round so the CSS countdown replays.
        <div
          key={`round-${round}`}
          className={paused ? 'countdown paused' : 'countdown'}
          style={{ '--countdown': `${COUNTDOWN_MS}ms` } as CSSProperties}
        >
          <span className="ready">
            <span className={`tier ${stage.tier}`}>
              {levelLabel} · {stage.tier}
            </span>
            <span className="banner">{stage.name}</span>
            <StagePreview stage={stage} />
          </span>
          <span className="banner go">Go!</span>
        </div>
      )}

      <div className="help">
        {/* Key hints are no use on a touch screen, where the controls are labelled buttons. */}
        {!isTouch && <div>WASD / arrows move · Space dash · Shift block · E jump · 1 2 3 emotes · Esc menu</div>}
        {mode === 'online' && hasRival && showPing && <Ping />}
      </div>
      {isTouch && !match && !waiting && <TouchControls />}
    </div>
  )
}
