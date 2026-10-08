// Wire protocol shared by the client and the relay server. All messages are JSON.

export const DEFAULT_PORT = 8787
export const MAX_PLAYERS = 2
export const STATE_HZ = 20
export const ROUND_RESET_MS = 900
// Pause at the start of each round before fighters can move.
export const COUNTDOWN_MS = 1500
// Round wins needed to take the match.
export const WINS_TO_MATCH = 3

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

// p: position, v: velocity on the ground plane, h: facing direction, d: currently dashing.
export type PlayerState = { p: Vec3; v: Vec2; h: Vec2; d: boolean }

export type Peer = { id: string; slot: number }
export type Scores = Record<string, number>

export type ClientMsg =
  | { type: 'join'; room: string }
  | ({ type: 'state' } & PlayerState)
  // impulse: the velocity change the target should apply to itself.
  | { type: 'hit'; target: string; impulse: Vec3 }
  | { type: 'eliminated' }
  | { type: 'rematch' }
  | { type: 'ping'; t: number }

export type ServerMsg =
  | { type: 'welcome'; id: string; slot: number; peers: Peer[] }
  | { type: 'full' }
  | { type: 'joined'; id: string; slot: number }
  | { type: 'left'; id: string }
  | ({ type: 'state'; id: string } & PlayerState)
  | { type: 'hit'; from: string; impulse: Vec3 }
  | { type: 'roundEnd'; loser: string; scores: Scores }
  | { type: 'roundStart'; round: number; scores: Scores }
  | { type: 'matchEnd'; winner: string; scores: Scores }
  | { type: 'pong'; t: number }
