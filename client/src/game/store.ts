import { create } from 'zustand'
import { COUNTDOWN_MS, ROUND_RESET_MS, WINS_TO_MATCH } from '@plonko/shared'
import type { Peer } from '@plonko/shared'
import { sfx } from '../audio/sfx'

// The local player is always 'me' and the offline opponent 'bot'; remote players use their server id.
export type FighterId = string

type GameState = {
  // landing: the start screen. solo: against the bot, no server. online: in a room with another player.
  mode: 'landing' | 'solo' | 'online'
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
  // The other player has left mid-session; the player is asked whether to wait or quit.
  rivalLeft: boolean
  menuOpen: boolean
  setMenu: (open: boolean) => void
  beginRound: (changes?: Partial<GameState>) => void
  localKnockout: (loser: 'me' | 'bot') => void
  localRematch: () => void
  startSolo: () => void
  hitstop: (ms: number) => void
}

let menuOpenedAt = 0

export const useGame = create<GameState>((set, get) => ({
  mode: 'landing',
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
  rivalLeft: false,
  menuOpen: false,

  // Against the bot the menu is a real pause, so the round clock is pushed back by the time spent in it.
  setMenu: (open) => {
    const g = get()
    if (open === g.menuOpen) return
    if (open) menuOpenedAt = performance.now()
    const paused = !open && g.mode === 'solo' ? performance.now() - menuOpenedAt : 0
    set({ menuOpen: open, playAt: g.playAt + paused })
  },

  // Every round start goes through here: fighters respawn and the countdown restarts.
  beginRound: (changes) => {
    set((s) => ({ ...changes, round: s.round + 1, banner: null, playAt: performance.now() + COUNTDOWN_MS }))
    const round = get().round
    sfx.ready()
    setTimeout(() => get().round === round && sfx.go(), COUNTDOWN_MS)
  },

  // Solo rounds against the bot; online rounds are decided by the server.
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
      if (get().mode === 'solo') get().beginRound()
    }, ROUND_RESET_MS)
  },

  localRematch: () => get().beginRound({ scores: { me: 0, them: 0 }, match: null }),

  startSolo: () => get().beginRound({ mode: 'solo', scores: { me: 0, them: 0 }, match: null }),

  hitstop: (ms) => {
    if (ms <= 0 || get().frozen) return
    set({ frozen: true })
    setTimeout(() => set({ frozen: false }), ms)
  },
}))

// True once the countdown is over and until the round or match is decided. Never while the menu is open.
export const isPlaying = () => {
  const g = useGame.getState()
  return g.mode !== 'landing' && !g.match && !g.menuOpen && !g.rivalLeft && performance.now() >= g.playAt
}

// Slot 0 plays from the near side of the arena, slot 1 from the far side with the view turned round.
export const sideOf = (slot: number) => (slot % 2 === 0 ? 1 : -1)

// Per-frame state, kept out of React so it can be written from the physics step.
export const fx = { shake: 0 }
// The platform's current radius, which shrinks as a round goes on.
export const arena = { radius: 0 }
