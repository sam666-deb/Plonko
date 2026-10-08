import { create } from 'zustand'
import { CAMPAIGN, CAMPAIGN_WINS, COUNTDOWN_MS, DEFAULT_STAGE, ROUND_RESET_MS, WINS_TO_MATCH, pickStage, stageById } from '@plonko/shared'
import type { Peer } from '@plonko/shared'
import { sfx } from '../audio/sfx'
import { useSettings } from './settings'
import { resetStats } from './stats'
import { after } from './ticker'

// The local player is always 'me' and the offline opponent 'bot'; remote players use their server id.
export type FighterId = string

type GameState = {
  // landing: the start screen. solo: against the bot, no server. online: in a room with another player.
  mode: 'landing' | 'solo' | 'online'
  // Which landing screen is showing: the main one or the campaign's level select.
  screen: 'home' | 'levels'
  // The campaign level being played, counting from 0. null in a quick match or online.
  campaign: number | null
  scores: { me: number; them: number }
  round: number
  // The round of the current match, counting from 1, and the id of the stage it is played on.
  level: number
  stage: string
  // Identifies the round. Both players hold the same value online, so anything random that is
  // derived from it (where power-ups appear) comes out the same for both.
  seed: number
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
  startCampaign: (level: number) => void
  // Leaves the game for the campaign's level select.
  toLevels: () => void
  startSolo: () => void
  hitstop: (ms: number) => void
}

let menuOpenedAt = 0

// Solo matches choose their own stages, the way the server does online.
const nextLevel = (level: number, previous?: string) => ({ level, stage: pickStage(level, previous) })

export const useGame = create<GameState>((set, get) => ({
  mode: 'landing',
  screen: 'home',
  campaign: null,
  scores: { me: 0, them: 0 },
  round: 0,
  level: 1,
  stage: DEFAULT_STAGE,
  seed: 0,
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
    set((s) => ({ seed: s.round + 1, ...changes, round: s.round + 1, banner: null, playAt: performance.now() + COUNTDOWN_MS }))
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
    if (Math.max(scores.me, scores.them) >= winsNeeded()) {
      set({ scores, match: meWon ? 'won' : 'lost' })
      if (meWon && g.campaign !== null) saveStars(g.campaign, scores.them)
      if (meWon) sfx.matchWon()
      else sfx.matchLost()
      return
    }
    set({ scores, banner: meWon ? 'Knockout!' : 'You fell!' })
    if (meWon) sfx.roundWon()
    else sfx.roundLost()
    setTimeout(() => {
      const now = get()
      if (now.mode !== 'solo') return
      // A campaign level stays on its stage; a quick match moves up a tier each round.
      now.beginRound(now.campaign === null ? nextLevel(now.level + 1, now.stage) : { level: now.level + 1 })
    }, ROUND_RESET_MS)
  },

  localRematch: () => {
    const { campaign } = get()
    if (campaign !== null) return get().startCampaign(campaign)
    resetStats()
    get().beginRound({ scores: { me: 0, them: 0 }, match: null, ...nextLevel(1, get().stage) })
  },

  startCampaign: (level) => {
    resetStats()
    get().beginRound({ mode: 'solo', campaign: level, scores: { me: 0, them: 0 }, match: null, level: 1, stage: CAMPAIGN[level] })
  },

  toLevels: () => get().beginRound({ mode: 'landing', screen: 'levels', campaign: null, scores: { me: 0, them: 0 }, match: null }),

  startSolo: () => {
    resetStats()
    get().beginRound({ mode: 'solo', campaign: null, scores: { me: 0, them: 0 }, match: null, ...nextLevel(1) })
  },

  hitstop: (ms) => {
    if (ms <= 0 || get().frozen) return
    set({ frozen: true })
    after(ms, () => set({ frozen: false }))
  },
}))

// Round wins that take the match: fewer for a campaign level than for a full match.
export const winsNeeded = () => (useGame.getState().campaign === null ? WINS_TO_MATCH : CAMPAIGN_WINS)

// Three stars for a clean win, one fewer for each round dropped, and never fewer than one.
// Only ever raises a level's saved result.
function saveStars(level: number, roundsLost: number) {
  const stars = [...useSettings.getState().campaignStars]
  for (let n = 0; n <= level; n++) stars[n] ??= 0
  stars[level] = Math.max(stars[level], Math.max(1, 3 - roundsLost))
  useSettings.getState().change({ campaignStars: stars })
}

// True once the countdown is over and until the round or match is decided. Never while the menu is open.
export const isPlaying = () => {
  const g = useGame.getState()
  return g.mode !== 'landing' && !g.match && !g.menuOpen && !g.rivalLeft && performance.now() >= g.playAt
}

// Slot 0 plays from the near side of the arena, slot 1 from the far side with the view turned round.
export const sideOf = (slot: number) => (slot % 2 === 0 ? 1 : -1)

// Per-frame state, kept out of React so it can be written from the physics step.
export const fx = { shake: 0 }

export const currentStage = () => stageById(useGame.getState().stage)
