// Wire protocol shared by the client and the relay server. All messages are JSON.

export const DEFAULT_PORT = 8787
export const MAX_PLAYERS = 2
export const STATE_HZ = 20
export const ROUND_RESET_MS = 900
// Pause at the start of each round before fighters can move.
export const COUNTDOWN_MS = 1500
// Round wins needed to take the match.
export const WINS_TO_MATCH = 3

// The playable characters. A player's choice is sent when they join a room.
export const AVATARS = ['warrior', 'rogue', 'mage', 'minion'] as const
export type Avatar = (typeof AVATARS)[number]

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

// p: position, v: velocity on the ground plane, h: facing direction, d: currently dashing, b: currently blocking,
// dmg: damage taken this round, e: active power-ups as a bit mask (see POWER_BITS).
// em: the emote being played, as an index into EMOTES plus one; 0 for none.
export type PlayerState = { p: Vec3; v: Vec2; h: Vec2; d: boolean; b: boolean; dmg: number; e: number; em: number }

// The emotes, in key order: 1, 2 and 3.
export const EMOTES = ['taunt', 'cheer', 'wave'] as const
export const MAX_NAME_LENGTH = 14

export const POWER_BITS = { heavy: 1, quick: 2 }

export type Peer = { id: string; slot: number; avatar: Avatar; name: string }
export type Scores = Record<string, number>

export type ClientMsg =
  | { type: 'join'; room: string; avatar: Avatar; name: string }
  | ({ type: 'state' } & PlayerState)
  // impulse: the velocity change the target should apply to itself.
  // recoil: this is the kick-back sent to an attacker whose hit was blocked, not a hit of its own.
  | { type: 'hit'; target: string; impulse: Vec3; recoil: boolean }
  | { type: 'eliminated' }
  // Asks for power-up number `item` of this round. The server grants each one to the first to ask.
  | { type: 'pickup'; item: number }
  | { type: 'rematch' }
  | { type: 'ping'; t: number }

export type ServerMsg =
  | { type: 'welcome'; id: string; slot: number; peers: Peer[] }
  | { type: 'full' }
  | ({ type: 'joined' } & Peer)
  | { type: 'left'; id: string }
  | ({ type: 'state'; id: string } & PlayerState)
  | { type: 'hit'; from: string; impulse: Vec3; recoil: boolean }
  | { type: 'roundEnd'; loser: string; scores: Scores }
  // level: which round of the match this is, counting from 1. stage: the arena to play it on.
  | { type: 'roundStart'; round: number; scores: Scores; level: number; stage: string }
  | { type: 'matchEnd'; winner: string; scores: Scores }
  | { type: 'pickup'; id: string; item: number }
  | { type: 'pong'; t: number }
