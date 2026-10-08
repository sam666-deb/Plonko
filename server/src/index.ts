import { randomBytes } from 'node:crypto'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { AVATARS, DEFAULT_PORT, DEFAULT_STAGE, MAX_NAME_LENGTH, MAX_PLAYERS, ROUND_RESET_MS, WINS_TO_MATCH, pickStage } from '@plonko/shared'
import type { Avatar, ClientMsg, Scores, ServerMsg } from '@plonko/shared'

// Relay only: clients simulate their own physics. The server owns who is in a room,
// the score, and when a round or match ends and restarts.

type Player = { id: string; slot: number; avatar: Avatar; name: string; ws: WebSocket }
type Room = {
  players: Map<string, Player>
  scores: Scores
  round: number
  // The round of the current match, counting from 1, and the stage it is played on.
  level: number
  stage: string
  // A round has been decided and the next one has not started yet.
  resolving: boolean
  // Someone has won the match; waiting for a rematch request.
  ended: boolean
  // Power-ups already picked up this round.
  claimed: Set<number>
}

const HEARTBEAT_MS = 15000
// Largest velocity change a hit may carry, per axis. Real hits are well under this.
const MAX_IMPULSE = 60

const rooms = new Map<string, Room>()
const port = Number(process.env.PORT) || DEFAULT_PORT
const wss = new WebSocketServer({ port, maxPayload: 1024 })

const send = (ws: WebSocket, msg: ServerMsg) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

const broadcast = (room: Room, msg: ServerMsg, except?: string) => {
  for (const p of room.players.values()) if (p.id !== except) send(p.ws, msg)
}

const isVec = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every((n) => typeof n === 'number' && Number.isFinite(n))

function startRound(room: Room, newMatch: boolean) {
  if (newMatch) {
    for (const id of room.players.keys()) room.scores[id] = 0
    room.ended = false
    room.level = 0
  }
  room.resolving = false
  room.claimed.clear()
  room.round++
  room.level++
  // Each level is a tier harder, on a stage drawn from that tier. A lone player waits on the default stage.
  room.stage = room.players.size < 2 ? DEFAULT_STAGE : pickStage(room.level, room.stage)
  broadcast(room, { type: 'roundStart', round: room.round, scores: room.scores, level: room.level, stage: room.stage })
}

function join(ws: WebSocket, code: string, avatar: Avatar, name: string): { room: Room; player: Player } | null {
  let room = rooms.get(code)
  if (!room) {
    room = { players: new Map(), scores: {}, round: 0, level: 0, stage: DEFAULT_STAGE, resolving: false, ended: false, claimed: new Set() }
    rooms.set(code, room)
  }
  if (room.players.size >= MAX_PLAYERS) {
    send(ws, { type: 'full' })
    ws.close()
    return null
  }

  const taken = new Set([...room.players.values()].map((p) => p.slot))
  let slot = 0
  while (taken.has(slot)) slot++

  const player: Player = { id: randomBytes(4).toString('hex'), slot, avatar, name, ws }
  const peers = [...room.players.values()].map((p) => ({ id: p.id, slot: p.slot, avatar: p.avatar, name: p.name }))
  room.players.set(player.id, player)

  send(ws, { type: 'welcome', id: player.id, slot, peers })
  broadcast(room, { type: 'joined', id: player.id, slot, avatar, name }, player.id)
  startRound(room, true)
  return { room, player }
}

const alive = new WeakSet<WebSocket>()

wss.on('connection', (ws) => {
  let session: { room: Room; player: Player } | null = null
  let code = ''

  alive.add(ws)
  ws.on('pong', () => alive.add(ws))

  ws.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (typeof msg !== 'object' || msg === null) return

    if (msg.type === 'ping') return send(ws, { type: 'pong', t: Number(msg.t) || 0 })
    if (msg.type === 'join') {
      if (session || typeof msg.room !== 'string' || !msg.room) return
      code = msg.room.slice(0, 32)
      // Names are shown to the other player, so they are trimmed to a short run of ordinary characters.
      const name = (typeof msg.name === 'string' ? msg.name : '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, MAX_NAME_LENGTH)
      session = join(ws, code, AVATARS.includes(msg.avatar) ? msg.avatar : 'minion', name || 'Player')
      return
    }
    if (!session) return
    const { room, player } = session

    switch (msg.type) {
      case 'state':
        if (!isVec(msg.p, 3) || !isVec(msg.v, 2) || !isVec(msg.h, 2)) break
        broadcast(room, { type: 'state', id: player.id, p: msg.p, v: msg.v, h: msg.h, d: Boolean(msg.d), b: Boolean(msg.b), dmg: Math.min(999, Math.max(0, Number(msg.dmg) || 0)), e: Number(msg.e) & 3, em: Math.min(3, Math.max(0, Number(msg.em) | 0)) }, player.id)
        break
      case 'hit': {
        const target = room.players.get(msg.target)
        if (!target || target === player || !isVec(msg.impulse, 3) || room.resolving || room.ended) break
        const [x, y, z] = msg.impulse.map((n) => Math.max(-MAX_IMPULSE, Math.min(MAX_IMPULSE, n)))
        send(target.ws, { type: 'hit', from: player.id, impulse: [x, y, z], recoil: Boolean(msg.recoil) })
        break
      }
      case 'eliminated': {
        if (room.resolving || room.ended || room.players.size < 2) break
        let winner = ''
        for (const id of room.players.keys()) {
          if (id === player.id) continue
          room.scores[id]++
          if (room.scores[id] >= WINS_TO_MATCH) winner = id
        }
        if (winner) {
          room.ended = true
          broadcast(room, { type: 'matchEnd', winner, scores: room.scores })
          break
        }
        room.resolving = true
        broadcast(room, { type: 'roundEnd', loser: player.id, scores: room.scores })
        setTimeout(() => {
          // Skip if a join, leave or rematch has already started a newer round.
          if (rooms.get(code) === room && room.resolving) startRound(room, false)
        }, ROUND_RESET_MS)
        break
      }
      case 'pickup':
        if (!Number.isInteger(msg.item) || msg.item < 0 || room.claimed.has(msg.item) || room.resolving || room.ended) break
        room.claimed.add(msg.item)
        broadcast(room, { type: 'pickup', id: player.id, item: msg.item })
        break
      case 'rematch':
        if (room.ended) startRound(room, true)
        break
    }
  })

  ws.on('close', () => {
    if (!session) return
    const { room, player } = session
    room.players.delete(player.id)
    delete room.scores[player.id]
    if (room.players.size === 0) {
      rooms.delete(code)
      return
    }
    broadcast(room, { type: 'left', id: player.id })
    startRound(room, true)
  })
})

// Drop connections that have gone silent, so a vanished player frees their slot.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate()
      continue
    }
    alive.delete(ws)
    ws.ping()
  }
}, HEARTBEAT_MS)

console.log(`Plonko relay listening on ws://localhost:${port}`)
