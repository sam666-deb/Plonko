import { create } from 'zustand'

export type FighterId = 'player' | 'bot'

const ROUND_RESET_MS = 900

type GameState = {
  scores: Record<FighterId, number>
  round: number
  frozen: boolean
  banner: string | null
  knockout: (loser: FighterId) => void
  hitstop: (ms: number) => void
  resetScores: () => void
}

export const useGame = create<GameState>((set, get) => ({
  scores: { player: 0, bot: 0 },
  round: 0,
  frozen: false,
  banner: null,

  knockout: (loser) => {
    if (get().banner) return
    const winner: FighterId = loser === 'player' ? 'bot' : 'player'
    set((s) => ({
      scores: { ...s.scores, [winner]: s.scores[winner] + 1 },
      banner: winner === 'player' ? 'Knockout!' : 'You fell!',
    }))
    setTimeout(() => set((s) => ({ round: s.round + 1, banner: null })), ROUND_RESET_MS)
  },

  hitstop: (ms) => {
    if (ms <= 0 || get().frozen) return
    set({ frozen: true })
    setTimeout(() => set({ frozen: false }), ms)
  },

  resetScores: () => set((s) => ({ scores: { player: 0, bot: 0 }, round: s.round + 1 })),
}))

// Per-frame effects state, kept out of React so it can be written from the physics step.
export const fx = { shake: 0 }
