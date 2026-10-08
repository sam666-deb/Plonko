// Wire protocol shared by the client and the relay server. All messages are JSON.

export const DEFAULT_PORT = 8787
export const MAX_PLAYERS = 2
export const STATE_HZ = 20
export const ROUND_RESET_MS = 900

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

// p: position, h: facing direction on the ground plane, d: currently dashing.
export type PlayerState = { p: Vec3; h: Vec2; d: boolean }

export type Peer = { id: string; slot: number }
export type Scores = Record<string, number>

export type ClientMsg =
  | { type: 'join'; room: string }
  | ({ type: 'state' } & PlayerState)
  | { type: 'hit'; target: string; dir: Vec2; power: number }
  | { type: 'eliminated' }
  | { type: 'ping'; t: number }

export type ServerMsg =
  | { type: 'welcome'; id: string; slot: number; peers: Peer[] }
  | { type: 'full' }
  | { type: 'joined'; id: string; slot: number }
  | { type: 'left'; id: string }
  | ({ type: 'state'; id: string } & PlayerState)
  | { type: 'hit'; from: string; dir: Vec2; power: number }
  | { type: 'roundEnd'; loser: string; scores: Scores }
  | { type: 'roundStart'; round: number; scores: Scores }
  | { type: 'pong'; t: number }
