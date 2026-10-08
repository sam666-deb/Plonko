import { create } from 'zustand'
import { COUNTDOWN_MS, ROUND_RESET_MS, WINS_TO_MATCH } from '@plonko/shared'
import type { Peer } from '@plonko/shared'
import { sfx } from '../audio/sfx'

// The local player is always 'me' and the offline opponent 'bot'; remote players use their server id.
export type FighterId = string

type GameState = {
  scores: { me: number; them: number }
  round: number
  // performance.now() at which the current round's countdown ends and fighters may move.
  playAt: number
  frozen: boolean
  // Counts knockouts, so the HUD can replay its screen flash for each one.
  flashes: number
  banner: string | null
  // Set once someone has won enough rounds; cleared by a rematch.
  match: 'won' | 'lost' | null
  // Set by the network layer once the server has welcomed us.
  selfId: string | null
  slot: number
  peers: Peer[]
  beginRound: (changes?: Partial<GameState>) => void
  localKnockout: (loser: 'me' | 'bot') => void
  localRematch: () => void
  hitstop: (ms: number) => void
}

export const useGame = create<GameState>((set, get) => ({
  scores: { me: 0, them: 0 },
  round: 0,
  playAt: performance.now() + COUNTDOWN_MS,
  frozen: false,
  flashes: 0,
  banner: null,
  match: null,
  selfId: null,
  slot: 0,
  peers: [],

  // Every round start goes through here: fighters respawn and the countdown restarts.
  beginRound: (changes) => {
    set((s) => ({ ...changes, round: s.round + 1, banner: null, playAt: performance.now() + COUNTDOWN_MS }))
    const round = get().round
    sfx.ready()
    setTimeout(() => get().round === round && sfx.go(), COUNTDOWN_MS)
  },

  // Offline rounds against the bot; online rounds are decided by the server.
  localKnockout: (loser) => {
    const g = get()
    if (g.banner || g.match) return
    const meWon = loser === 'bot'
    const scores = { me: g.scores.me + (meWon ? 1 : 0), them: g.scores.them + (meWon ? 0 : 1) }
    if (Math.max(scores.me, scores.them) >= WINS_TO_MATCH) {
      set({ scores, match: meWon ? 'won' : 'lost' })
      if (meWon) sfx.matchWon()
      else sfx.matchLost()
      return
    }
    set({ scores, banner: meWon ? 'Knockout!' : 'You fell!' })
    if (meWon) sfx.roundWon()
    else sfx.roundLost()
    setTimeout(() => {
      if (get().peers.length === 0) get().beginRound()
    }, ROUND_RESET_MS)
  },

  localRematch: () => get().beginRound({ scores: { me: 0, them: 0 }, match: null }),

  hitstop: (ms) => {
    if (ms <= 0 || get().frozen) return
    set({ frozen: true })
    setTimeout(() => set({ frozen: false }), ms)
  },
}))

// True once the countdown is over and until the round or match is decided.
export const isPlaying = () => {
  const g = useGame.getState()
  return !g.match && performance.now() >= g.playAt
}

// Slot 0 plays from the near side of the arena, slot 1 from the far side with the view turned round.
export const sideOf = (slot: number) => (slot % 2 === 0 ? 1 : -1)

// Per-frame state, kept out of React so it can be written from the physics step.
export const fx = { shake: 0 }
// The platform's current radius, which shrinks as a round goes on.
export const arena = { radius: 0 }
