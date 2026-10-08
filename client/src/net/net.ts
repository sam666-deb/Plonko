import { DEFAULT_PORT, STATE_HZ } from '@plonko/shared'
import type { ClientMsg, PlayerState, Scores, ServerMsg } from '@plonko/shared'
import { fighters } from '../game/fighters'
import { fx, useGame } from '../game/store'
import { tuning } from '../game/tuning'

const URL_ = import.meta.env.VITE_WS_URL ?? `ws://${location.hostname}:${DEFAULT_PORT}`
const ROOM = new URLSearchParams(location.search).get('room') ?? 'dev'
const RECONNECT_MS = 2000
const BUFFER_MS = 1000

export type Snapshot = PlayerState & { t: number }

// Recent states per remote player, stamped with local receive time, oldest first.
export const snapshots = new Map<string, Snapshot[]>()

export const netStats = { connected: false, ping: 0, recvHz: 0, room: ROOM }

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
  useGame.setState({ selfId: null, slot: 0, peers: [], scores: { me: 0, them: 0 }, banner: null, round: g.round + 1 })
}

function onMessage(msg: ServerMsg) {
  const g = useGame.getState()
  switch (msg.type) {
    case 'welcome':
      useGame.setState({ selfId: msg.id, slot: msg.slot, peers: msg.peers })
      break
    case 'joined':
      useGame.setState({ peers: [...g.peers, { id: msg.id, slot: msg.slot }] })
      break
    case 'left':
      snapshots.delete(msg.id)
      useGame.setState({ peers: g.peers.filter((p) => p.id !== msg.id) })
      break
    case 'state': {
      received++
      const now = performance.now()
      const buf = snapshots.get(msg.id) ?? []
      buf.push({ t: now, p: msg.p, h: msg.h, d: msg.d })
      while (buf.length > 2 && buf[0].t < now - BUFFER_MS) buf.shift()
      snapshots.set(msg.id, buf)
      break
    }
    case 'hit':
      fighters.get('me')?.takeHit(msg.dir[0], msg.dir[1], msg.power)
      fx.shake = tuning.shake
      g.hitstop(tuning.hitstopMs)
      break
    case 'roundEnd':
      useGame.setState({
        scores: applyScores(msg.scores),
        banner: msg.loser === g.selfId ? 'You fell!' : 'Knockout!',
      })
      break
    case 'roundStart':
      snapshots.clear()
      useGame.setState({ scores: applyScores(msg.scores), banner: null, round: g.round + 1 })
      break
    case 'pong':
      netStats.ping = Math.round(performance.now() - msg.t)
      break
    case 'full':
      console.warn(`Room "${ROOM}" is full`)
      break
  }
}

function open() {
  const socket = new WebSocket(URL_)
  ws = socket
  socket.onopen = () => {
    netStats.connected = true
    socket.send(JSON.stringify({ type: 'join', room: ROOM } satisfies ClientMsg))
  }
  socket.onmessage = (e) => onMessage(JSON.parse(e.data))
  socket.onclose = () => {
    goOffline()
    setTimeout(open, RECONNECT_MS)
  }
}

// A fighter simulated on this client fell off. Offline that ends the round here; online the
// server decides, and only our own fall is ours to report.
export function reportFall(id: string) {
  const g = useGame.getState()
  if (g.peers.length === 0) g.localKnockout(id === 'me' ? 'me' : 'bot')
  else if (id === 'me') send({ type: 'eliminated' })
}

export function sendHit(target: string, dirX: number, dirZ: number, power: number) {
  send({ type: 'hit', target, dir: [dirX, dirZ], power })
}

export function connect() {
  open()

  setInterval(() => {
    const me = fighters.get('me')
    if (!me || useGame.getState().peers.length === 0) return
    const p = me.body.translation()
    send({ type: 'state', p: [p.x, p.y, p.z], h: me.heading(), d: me.isDashing() })
  }, 1000 / STATE_HZ)

  setInterval(() => {
    netStats.recvHz = received
    received = 0
    // Pings skip the simulator so the readout shows the real connection.
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping', t: performance.now() } satisfies ClientMsg))
  }, 1000)
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
      h: b.h,
      d: a.d,
    }
  }
  return buf[0]
}
