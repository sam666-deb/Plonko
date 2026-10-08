import { randomBytes } from 'node:crypto'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { DEFAULT_PORT, MAX_PLAYERS, ROUND_RESET_MS } from '@plonko/shared'
import type { ClientMsg, Scores, ServerMsg } from '@plonko/shared'

// Relay only: clients simulate their own physics. The server owns who is in a room,
// the score, and when a round ends and restarts.

type Player = { id: string; slot: number; ws: WebSocket }
type Room = { players: Map<string, Player>; scores: Scores; round: number; resolving: boolean }

const rooms = new Map<string, Room>()
const port = Number(process.env.PORT) || DEFAULT_PORT
const wss = new WebSocketServer({ port, maxPayload: 1024 })

const send = (ws: WebSocket, msg: ServerMsg) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
}

const broadcast = (room: Room, msg: ServerMsg, except?: string) => {
  for (const p of room.players.values()) if (p.id !== except) send(p.ws, msg)
}

function startRound(room: Room, resetScores: boolean) {
  if (resetScores) for (const id of room.players.keys()) room.scores[id] = 0
  room.resolving = false
  room.round++
  broadcast(room, { type: 'roundStart', round: room.round, scores: room.scores })
}

function join(ws: WebSocket, code: string): { room: Room; player: Player } | null {
  let room = rooms.get(code)
  if (!room) {
    room = { players: new Map(), scores: {}, round: 0, resolving: false }
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

  const player: Player = { id: randomBytes(4).toString('hex'), slot, ws }
  const peers = [...room.players.values()].map((p) => ({ id: p.id, slot: p.slot }))
  room.players.set(player.id, player)

  send(ws, { type: 'welcome', id: player.id, slot, peers })
  broadcast(room, { type: 'joined', id: player.id, slot }, player.id)
  startRound(room, true)
  return { room, player }
}

wss.on('connection', (ws) => {
  let session: { room: Room; player: Player } | null = null
  let code = ''

  ws.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }

    if (msg.type === 'ping') return send(ws, { type: 'pong', t: msg.t })
    if (msg.type === 'join') {
      if (session || typeof msg.room !== 'string') return
      code = msg.room.slice(0, 32)
      session = join(ws, code)
      return
    }
    if (!session) return
    const { room, player } = session

    switch (msg.type) {
      case 'state':
        broadcast(room, { type: 'state', id: player.id, p: msg.p, h: msg.h, d: msg.d }, player.id)
        break
      case 'hit': {
        const target = room.players.get(msg.target)
        if (target) send(target.ws, { type: 'hit', from: player.id, dir: msg.dir, power: msg.power })
        break
      }
      case 'eliminated':
        if (room.resolving || room.players.size < 2) break
        room.resolving = true
        for (const id of room.players.keys()) if (id !== player.id) room.scores[id]++
        broadcast(room, { type: 'roundEnd', loser: player.id, scores: room.scores })
        setTimeout(() => rooms.get(code) === room && startRound(room, false), ROUND_RESET_MS)
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

console.log(`Plonko relay listening on ws://localhost:${port}`)
