import { create } from 'zustand'
import { ROUND_RESET_MS } from '@plonko/shared'
import type { Peer } from '@plonko/shared'

// The local player is always 'me' and the offline opponent 'bot'; remote players use their server id.
export type FighterId = string

type GameState = {
  scores: { me: number; them: number }
  round: number
  frozen: boolean
  banner: string | null
  // Set by the network layer once the server has welcomed us.
  selfId: string | null
  slot: number
  peers: Peer[]
  localKnockout: (loser: 'me' | 'bot') => void
  hitstop: (ms: number) => void
  resetScores: () => void
}

export const useGame = create<GameState>((set, get) => ({
  scores: { me: 0, them: 0 },
  round: 0,
  frozen: false,
  banner: null,
  selfId: null,
  slot: 0,
  peers: [],

  // Offline rounds against the bot; online rounds are decided by the server.
  localKnockout: (loser) => {
    if (get().banner) return
    const meWon = loser === 'bot'
    set((s) => ({
      scores: { me: s.scores.me + (meWon ? 1 : 0), them: s.scores.them + (meWon ? 0 : 1) },
      banner: meWon ? 'Knockout!' : 'You fell!',
    }))
    setTimeout(() => {
      if (get().peers.length === 0) set((s) => ({ round: s.round + 1, banner: null }))
    }, ROUND_RESET_MS)
  },

  hitstop: (ms) => {
    if (ms <= 0 || get().frozen) return
    set({ frozen: true })
    setTimeout(() => set({ frozen: false }), ms)
  },

  resetScores: () => {
    if (get().peers.length === 0) set((s) => ({ scores: { me: 0, them: 0 }, round: s.round + 1 }))
  },
}))

// Slot 0 plays from the near side of the arena, slot 1 from the far side with the view turned round.
export const sideOf = (slot: number) => (slot % 2 === 0 ? 1 : -1)

// Per-frame effects state, kept out of React so it can be written from the physics step.
export const fx = { shake: 0 }
