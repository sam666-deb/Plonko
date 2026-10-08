import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Avatar } from '@plonko/shared'

// Player preferences, remembered in the browser between visits.
export type Settings = {
  avatar: Avatar
  muted: boolean
  volume: number
  // Multiplier on camera shake; 0 turns it off.
  shake: number
  flash: boolean
  shadows: boolean
  showNetStats: boolean
}

type SettingsState = Settings & { change: (changes: Partial<Settings>) => void }

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      avatar: 'warrior',
      muted: false,
      volume: 0.7,
      shake: 1,
      flash: true,
      shadows: true,
      showNetStats: false,
      change: (changes) => set(changes),
    }),
    { name: 'plonko-settings' },
  ),
)
