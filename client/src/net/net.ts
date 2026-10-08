import { DEFAULT_PORT, POWER_BITS, STATE_HZ } from '@plonko/shared'
import type { ClientMsg, PlayerState, Scores, ServerMsg } from '@plonko/shared'
import { sfx } from '../audio/sfx'
import { burst } from '../game/effects'
import { fighters } from '../game/fighters'
import { askOnce, kindOf, markTaken } from '../game/powerups'
import type { Item } from '../game/powerups'
import { recordBlockedAfterAll, recordHit, recordItem, resetStats } from '../game/stats'
import { useSettings } from '../game/settings'
import { every } from '../game/ticker'
import { fx, useGame } from '../game/store'
import { tuning } from '../game/tuning'

const URL_ = import.meta.env.VITE_WS_URL ?? `ws://${location.hostname}:${DEFAULT_PORT}`

// A secure page can only open secure sockets. A build with no relay address set can still reach
// the development relay from a plain http page, but from an https one online play is off.
export const ONLINE_AVAILABLE = Boolean(import.meta.env.VITE_WS_URL) || location.protocol === 'http:'

// Inside a frame (itch.io) the page's own address is not one a friend can open, so the room
// is shared by its code instead of by link.
export const EMBEDDED = window.self !== window.top

export const cleanCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
export const roomCode = () => room
const RECONNECT_MS = 2000
const BUFFER_MS = 1000

export type Snapshot = PlayerState & { t: number }

// Recent states per remote player, stamped with local receive time, oldest first.
export const snapshots = new Map<string, Snapshot[]>()

// full: the room already had its two players, so we were turned away.
export const netStats = { connected: false, full: false, ping: 0, recvHz: 0 }

let room = ''

let ws: WebSocket | null = null
let lastDeliverAt = 0
let received = 0

// All outgoing traffic goes through the latency simulator. Loss only applies to state
// updates, because the real transport never drops the one-off messages.
function send(msg: ClientMsg) {
  const socket = ws
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  if (msg.type === 'state' && Math.random() * 100 < tuning.simLossPct) return

  const delay = tuning.simLatencyMs + Math.random() * tuning.simJitterMs
  if (delay <= 0 && lastDeliverAt <= performance.now()) return socket.send(JSON.stringify(msg))
  // Never deliver out of order, as the real transport would not either.
  lastDeliverAt = Math.max(lastDeliverAt, performance.now() + delay)
  setTimeout(() => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(msg)), lastDeliverAt - performance.now())
}

function applyScores(scores: Scores) {
  const selfId = useGame.getState().selfId
  let me = 0
  let them = 0
  for (const [id, n] of Object.entries(scores)) {
    if (id === selfId) me = n
    else them += n
  }
  return { me, them }
}

function goOffline() {
  netStats.connected = false
  snapshots.clear()
  const g = useGame.getState()
  if (g.selfId === null && g.peers.length === 0) return
  g.beginRound({ selfId: null, slot: 0, peers: [], scores: { me: 0, them: 0 }, match: null })
}

function onMessage(msg: ServerMsg) {
  const g = useGame.getState()
  switch (msg.type) {
    case 'welcome':
      useGame.setState({ selfId: msg.id, slot: msg.slot, peers: msg.peers })
      break
    case 'joined':
      useGame.setState({ peers: [...g.peers, { id: msg.id, slot: msg.slot, avatar: msg.avatar, name: msg.name }], rivalLeft: false })
      break
    case 'left':
      snapshots.delete(msg.id)
      useGame.setState({ peers: g.peers.filter((p) => p.id !== msg.id), rivalLeft: true })
      break
    case 'state': {
      received++
      const now = performance.now()
      const buf = snapshots.get(msg.id) ?? []
      buf.push({ t: now, p: msg.p, v: msg.v, h: msg.h, d: msg.d, b: msg.b, dmg: msg.dmg, e: msg.e, em: msg.em })
      while (buf.length > 2 && buf[0].t < now - BUFFER_MS) buf.shift()
      snapshots.set(msg.id, buf)
      break
    }
    case 'hit': {
      const me = fighters.get('me')
      if (!me?.body) break
      const at = me.body.translation()
      const [ix, , iz] = msg.impulse
      if (msg.recoil) {
        // Our hit was blocked: the other client sends the kick-back.
        recordBlockedAfterAll()
        me.recoil(ix, iz)
        sfx.block()
        burst({ x: at.x, y: at.y + 0.2, z: at.z, count: 10, color: '#dff4ff', speed: 5, up: 1.5, life: 0.3 })
        break
      }
      const blocked = me.takeHit(ix, iz, msg.impulse[1])
      recordHit('them', 'me', blocked)
      if (blocked) {
        send({ type: 'hit', target: msg.from, impulse: [-ix * tuning.blockRecoil, 0, -iz * tuning.blockRecoil], recoil: true })
        break
      }
      burst({ x: at.x, y: at.y + 0.2, z: at.z, count: 14, color: '#fde68a', speed: 4, up: 2 })
      fx.shake = tuning.shake
      sfx.hit(Math.min(1.5, Math.hypot(msg.impulse[0], msg.impulse[2]) / 10))
      g.hitstop(tuning.hitstopMs)
      break
    }
    case 'roundEnd':
      if (msg.loser === g.selfId) sfx.roundLost()
      else sfx.roundWon()
      useGame.setState({
        scores: applyScores(msg.scores),
        banner: msg.loser === g.selfId ? 'You fell!' : 'Knockout!',
      })
      break
    case 'roundStart':
      snapshots.clear()
      if (msg.level === 1) resetStats()
      g.beginRound({ scores: applyScores(msg.scores), match: null, level: msg.level, stage: msg.stage, seed: msg.round })
      break
    case 'matchEnd':
      if (msg.winner === g.selfId) sfx.matchWon()
      else sfx.matchLost()
      useGame.setState({ scores: applyScores(msg.scores), banner: null, match: msg.winner === g.selfId ? 'won' : 'lost' })
      break
    case 'pickup':
      // The server has settled who got this item.
      markTaken(msg.item)
      if (msg.id === g.selfId) fighters.get('me')?.grant(kindOf(msg.item))
      else {
        recordItem('them')
        sfx.pickup()
      }
      break
    case 'pong':
      netStats.ping = Math.round(performance.now() - msg.t)
      break
    case 'full':
      netStats.full = true
      break
  }
}

function open() {
  const socket = new WebSocket(URL_)
  ws = socket
  socket.onopen = () => {
    netStats.connected = true
    socket.send(JSON.stringify({ type: 'join', room, avatar: useSettings.getState().avatar, name: useSettings.getState().name } satisfies ClientMsg))
  }
  socket.onmessage = (e) => onMessage(JSON.parse(e.data))
  socket.onclose = () => {
    goOffline()
    if (!netStats.full) setTimeout(open, RECONNECT_MS)
  }
}

// A fighter simulated on this client fell off. Solo that ends the round here; online the
// server decides, and only our own fall is ours to report.
export function reportFall(id: string) {
  const g = useGame.getState()
  if (g.mode === 'solo') g.localKnockout(id === 'me' ? 'me' : 'bot')
  else if (id !== 'me') return
  else if (g.peers.length > 0) send({ type: 'eliminated' })
  // Alone in the room while waiting for a rival: just put the player back.
  else g.beginRound()
}

// A fighter simulated here is touching a power-up. Solo it is theirs at once; online the server
// decides, in case both players reach it together, and only our own fighter may ask.
export function claimItem(id: string, item: Item) {
  if (useGame.getState().mode === 'solo') {
    markTaken(item.n)
    fighters.get(id)?.grant(item.kind)
  } else if (id === 'me' && askOnce(item.n)) {
    send({ type: 'pickup', item: item.n })
  }
}

export function requestRematch() {
  const g = useGame.getState()
  if (g.mode === 'solo') g.localRematch()
  else send({ type: 'rematch' })
}

export function sendHit(target: string, dvx: number, dvz: number, up: number) {
  send({ type: 'hit', target, impulse: [dvx, up, dvz], recoil: false })
}

// Enters online play. Joins the room with the given code, or the one named in the URL, or makes
// a new one. The code is put in the URL so the address bar is the invite link.
export function startOnline(code?: string) {
  if (room) return
  const url = new URL(location.href)
  room = cleanCode(code ?? url.searchParams.get('room') ?? '') || Math.random().toString(36).slice(2, 6)
  if (url.searchParams.get('room') !== room) {
    url.searchParams.set('room', room)
    history.replaceState(null, '', url)
  }
  useGame.getState().beginRound({ mode: 'online', scores: { me: 0, them: 0 }, match: null })
  open()

  every(1000 / STATE_HZ, () => {
    const me = fighters.get('me')
    if (!me?.body || useGame.getState().peers.length === 0) return
    const p = me.body.translation()
    const powers = me.powers()
    const e = (powers.heavy > 0 ? POWER_BITS.heavy : 0) | (powers.quick > 0 ? POWER_BITS.quick : 0)
    send({
      type: 'state',
      p: [p.x, p.y, p.z],
      v: me.velocity(),
      h: me.heading(),
      d: me.isDashing(),
      b: me.isBlocking(),
      dmg: Math.round(me.damage()),
      e,
      em: me.emote(),
    })
  })

  every(1000, () => {
    netStats.recvHz = received
    received = 0
    // Pings skip the simulator so the readout shows the real connection.
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping', t: performance.now() } satisfies ClientMsg))
  })
}

// Where a remote player was `interpDelayMs` ago, blended between the two states around that time.
export function sampleRemote(id: string): PlayerState | null {
  const buf = snapshots.get(id)
  if (!buf || buf.length === 0) return null
  const at = performance.now() - tuning.interpDelayMs
  const last = buf[buf.length - 1]
  if (at >= last.t) return last
  for (let i = buf.length - 2; i >= 0; i--) {
    const a = buf[i]
    if (a.t > at) continue
    const b = buf[i + 1]
    const k = (at - a.t) / (b.t - a.t || 1)
    return {
      p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k],
      v: a.v,
      h: b.h,
      d: a.d,
      b: a.b,
      dmg: b.dmg,
      e: b.e,
      em: b.em,
    }
  }
  return buf[0]
}
