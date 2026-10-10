import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Avatar } from '@plonko/shared'

// Player preferences, remembered in the browser between visits.
export type Settings = {
  avatar: Avatar
  name: string
  music: boolean
  musicVolume: number
  muted: boolean
  volume: number
  // Multiplier on camera shake; 0 turns it off.
  shake: number
  flash: boolean
  shadows: boolean
  showNetStats: boolean
  // Best result on each campaign level, by stage id: 1 to 3 stars. A stage that is missing has not been beaten.
  // Keyed by stage, not by position, so progress survives levels being added or reordered.
  campaignStars: Record<string, number>
}

const ORIGINAL_CAMPAIGN = ['hall', 'courtyard', 'ring', 'crossing', 'isles', 'frost', 'collapse', 'plank']

type SettingsState = Settings & { change: (changes: Partial<Settings>) => void }

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      avatar: 'warrior',
      name: '',
      music: true,
      musicVolume: 0.5,
      muted: false,
      volume: 0.7,
      shake: 1,
      flash: true,
      shadows: true,
      showNetStats: false,
      campaignStars: {},
      change: (changes) => set(changes),
    }),
    {
      name: 'plonko-settings',
      version: 1,
      // Before version 1 the stars were a list in the order of the original eight-level campaign.
      migrate: (saved) => {
        const state = saved as { campaignStars?: unknown }
        if (Array.isArray(state.campaignStars)) {
          const stars: Record<string, number> = {}
          state.campaignStars.forEach((n, i) => {
            if (n > 0 && ORIGINAL_CAMPAIGN[i]) stars[ORIGINAL_CAMPAIGN[i]] = n
          })
          state.campaignStars = stars
        }
        return state as SettingsState
      },
    },
  ),
)
