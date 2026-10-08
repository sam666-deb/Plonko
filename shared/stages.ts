// The arenas. A match climbs through the tiers one level per round, and each level's stage is
// drawn at random from its tier. This is pure data, shared so the server can pick the stage
// and both clients build the identical floor from it.

export const TIERS = ['normal', 'medium', 'hard', 'extreme'] as const
export type Tier = (typeof TIERS)[number]

export type TileSet = 'stone' | 'wood' | 'dirt'

// Colours that dress the scene around a stage.
export type Theme = {
  // Page background behind the 3D scene, top to bottom.
  sky: [string, string, string]
  fog: string
  // The glow at the bottom of the pit: centre and edge.
  pit: [string, string]
  torch: string
  ambient: string
  // The slab of stone under each tile, and a tint multiplied onto the tile's own texture.
  block: string
  tint: string
  // What stands on the two ledges beside the arena: three props from the dungeon pack, and
  // optionally a broken wall behind them, with or without a banner.
  props: [string, string, string]
  wall: 'none' | 'bare' | 'banner'
}

// Things on a stage that knock fighters about. Positions are in tiles from the centre.
export type Hazard =
  // A bar across the centre, `length` tiles to each side, turning once every `period` seconds
  // (negative turns the other way). It can be jumped.
  | { type: 'sweeper'; length: number; period: number }
  // Tiles whose spikes shoot up once every `period` seconds, after a short warning.
  | { type: 'spikes'; tiles: [number, number][]; period: number }
  // A post that bounces away anything that touches it. It goes when the tile under it falls.
  | { type: 'bumper'; at: [number, number] }

export type Stage = {
  id: string
  name: string
  tier: Tier
  tiles: TileSet
  theme: Theme
  // The floor, seen from above with the first player's side at the bottom.
  // 'o' is a tile that will fall, '#' a tile that never does, '.' is empty.
  map: string[]
  // Where the two players start, in tiles from the centre: [x, z] with +z towards the bottom row.
  spawns: [[number, number], [number, number]]
  // Seconds before the first tile goes, and how long the rest take to follow.
  collapseDelay: number
  collapseTime: number
  // How long a tile shakes before it drops.
  warn: number
  // 0 drops tiles strictly from the outside in; 1 drops them in a completely random order.
  chaos: number
  // Traction: 1 is normal footing, lower is slippery.
  grip: number
  hazards: Hazard[]
}

const CRYPT: Theme = {
  sky: ['#3a2352', '#1c1029', '#0a0610'],
  fog: '#140b1f',
  pit: ['#ffaa46', '#ff5a28'],
  torch: '#ffb066',
  ambient: '#b9a8ff',
  block: '#4a4458',
  tint: '#ffffff',
  props: ['barrel_large', 'chest', 'candle_triple'],
  wall: 'banner',
}

const GARDEN: Theme = {
  sky: ['#1f4a43', '#0f2a2a', '#06100f'],
  fog: '#0a1a18',
  pit: ['#9dff8a', '#1f9d6b'],
  torch: '#ffe08a',
  ambient: '#b5ffd9',
  block: '#3d3a2e',
  tint: '#ffffff',
  props: ['column', 'trunk_large_A', 'column'],
  wall: 'bare',
}

const TAVERN: Theme = {
  sky: ['#5a3418', '#2a160b', '#0e0704'],
  fog: '#1a0e07',
  pit: ['#ffd27a', '#e0661f'],
  torch: '#ffc67a',
  ambient: '#ffd9b0',
  block: '#3a2416',
  tint: '#ffffff',
  props: ['table_small_decorated_A', 'barrel_large', 'trunk_large_A'],
  wall: 'none',
}

const SEWER: Theme = {
  sky: ['#2f4a1c', '#16260f', '#070c05'],
  fog: '#0c1608',
  pit: ['#d6ff5a', '#4f9d1f'],
  torch: '#c8ff7a',
  ambient: '#d5ffa8',
  block: '#3b4034',
  tint: '#e6ffd6',
  props: ['barrel_large', 'column', 'barrel_large'],
  wall: 'bare',
}

const FROST: Theme = {
  sky: ['#1d4a78', '#0d2440', '#040b16'],
  fog: '#081424',
  pit: ['#c8f4ff', '#3d8bff'],
  torch: '#9fdcff',
  ambient: '#cfe9ff',
  block: '#3a5570',
  tint: '#bfe6ff',
  props: ['column', 'chest', 'column'],
  wall: 'none',
}

const INFERNO: Theme = {
  sky: ['#6b1414', '#2c0808', '#0d0202'],
  fog: '#1c0505',
  pit: ['#fff08a', '#ff2a12'],
  torch: '#ff8a4a',
  ambient: '#ffc0a8',
  block: '#3a1c1c',
  tint: '#ffd9cc',
  props: ['chest_gold', 'candle_triple', 'chest_gold'],
  wall: 'banner',
}

const VOID: Theme = {
  sky: ['#141b4a', '#080b24', '#020209'],
  fog: '#05061a',
  pit: ['#c9a8ff', '#3a1fd0'],
  torch: '#b9a0ff',
  ambient: '#c0c8ff',
  block: '#241a12',
  tint: '#ffffff',
  props: ['column', 'chest_gold', 'candle_triple'],
  wall: 'none',
}

const DISC = [
  '...ooo...',
  '..ooooo..',
  '.ooooooo.',
  'ooooooooo',
  'ooooooooo',
  'ooooooooo',
  '.ooooooo.',
  '..ooooo..',
  '...ooo...',
]

export const STAGES: Stage[] = [
  {
    id: 'hall',
    name: 'The Great Hall',
    tier: 'normal',
    tiles: 'stone',
    theme: CRYPT,
    map: [
      '...ooo...',
      '..ooooo..',
      '.ooooooo.',
      'ooo###ooo',
      'ooo###ooo',
      'ooo###ooo',
      '.ooooooo.',
      '..ooooo..',
      '...ooo...',
    ],
    spawns: [
      [0, 2],
      [0, -2],
    ],
    collapseDelay: 8,
    collapseTime: 25,
    warn: 1,
    chaos: 0.15,
    grip: 1,
    hazards: [],
  },
  {
    id: 'courtyard',
    name: 'Overgrown Courtyard',
    tier: 'normal',
    tiles: 'dirt',
    theme: GARDEN,
    map: ['ooooooo', 'ooooooo', 'oo###oo', 'oo###oo', 'oo###oo', 'ooooooo', 'ooooooo'],
    spawns: [
      [0, 2],
      [0, -2],
    ],
    collapseDelay: 8,
    collapseTime: 24,
    warn: 1,
    chaos: 0.15,
    grip: 1,
    hazards: [],
  },
  {
    id: 'ring',
    name: 'The Ring',
    tier: 'medium',
    tiles: 'stone',
    theme: CRYPT,
    map: [
      '...ooo...',
      '..ooooo..',
      '.ooooooo.',
      'ooo###ooo',
      'ooo#.#ooo',
      'ooo###ooo',
      '.ooooooo.',
      '..ooooo..',
      '...ooo...',
    ],
    spawns: [
      [0, 3],
      [0, -3],
    ],
    collapseDelay: 6,
    collapseTime: 20,
    warn: 0.9,
    chaos: 0.25,
    grip: 1,
    hazards: [{ type: 'sweeper', length: 3.5, period: 7 }],
  },
  {
    id: 'crossing',
    name: 'The Crossing',
    tier: 'medium',
    tiles: 'wood',
    theme: TAVERN,
    map: [
      '...ooo...',
      '...ooo...',
      '...ooo...',
      'ooo###ooo',
      'ooo###ooo',
      'ooo###ooo',
      '...ooo...',
      '...ooo...',
      '...ooo...',
    ],
    spawns: [
      [0, 3],
      [0, -3],
    ],
    collapseDelay: 6,
    collapseTime: 20,
    warn: 0.9,
    chaos: 0.25,
    grip: 1,
    hazards: [
      { type: 'bumper', at: [2, 0] },
      { type: 'bumper', at: [-2, 0] },
    ],
  },
  {
    id: 'isles',
    name: 'Twin Isles',
    tier: 'hard',
    tiles: 'stone',
    theme: SEWER,
    map: ['.ooooo.', '.ooooo.', '.ooooo.', '...#...', '...#...', '...#...', '.ooooo.', '.ooooo.', '.ooooo.'],
    spawns: [
      [0, 3],
      [0, -3],
    ],
    collapseDelay: 5,
    collapseTime: 18,
    warn: 0.8,
    chaos: 0.3,
    grip: 1,
    hazards: [{ type: 'spikes', tiles: [[0, 0]], period: 3.5 }],
  },
  {
    id: 'frost',
    name: 'Frostbite',
    tier: 'hard',
    tiles: 'stone',
    theme: FROST,
    map: ['..ooo..', '.ooooo.', 'ooo#ooo', 'oo###oo', 'ooo#ooo', '.ooooo.', '..ooo..'],
    spawns: [
      [0, 2],
      [0, -2],
    ],
    collapseDelay: 5,
    collapseTime: 18,
    warn: 0.8,
    chaos: 0.3,
    grip: 0.3,
    hazards: [
      { type: 'bumper', at: [2, 0] },
      { type: 'bumper', at: [-2, 0] },
    ],
  },
  {
    id: 'collapse',
    name: 'The Collapse',
    tier: 'extreme',
    tiles: 'stone',
    theme: INFERNO,
    map: DISC,
    spawns: [
      [0, 2],
      [0, -2],
    ],
    collapseDelay: 3,
    collapseTime: 17,
    warn: 0.7,
    chaos: 1,
    grip: 1,
    hazards: [
      { type: 'sweeper', length: 4, period: -4.5 },
      {
        type: 'spikes',
        tiles: [
          [2, 2],
          [-2, 2],
          [2, -2],
          [-2, -2],
        ],
        period: 4,
      },
    ],
  },
  {
    id: 'plank',
    name: 'The Plank',
    tier: 'extreme',
    tiles: 'wood',
    theme: VOID,
    map: ['ooooooooo', 'ooooooooo', 'ooooooooo'],
    spawns: [
      [-3, 0],
      [3, 0],
    ],
    collapseDelay: 3,
    collapseTime: 13,
    warn: 0.7,
    chaos: 0.2,
    grip: 1,
    hazards: [
      { type: 'sweeper', length: 1.4, period: 3.2 },
      {
        type: 'spikes',
        tiles: [
          [2, 0],
          [-2, 0],
        ],
        period: 3,
      },
    ],
  },
]

export const DEFAULT_STAGE = 'hall'

// The solo campaign: every stage in order of difficulty. Each level is a short match on one
// stage, and beating it opens the next.
export const CAMPAIGN = STAGES.map((s) => s.id)
export const CAMPAIGN_WINS = 2

export const stageById = (id: string): Stage => STAGES.find((s) => s.id === id) ?? STAGES[0]

// Level 1 is normal, 2 medium, 3 hard, and everything after that extreme.
export const tierForLevel = (level: number): Tier => TIERS[Math.min(Math.max(level, 1), TIERS.length) - 1]

// A random stage for a level, never the one just played.
export function pickStage(level: number, previous?: string): string {
  const tier = tierForLevel(level)
  const pool = STAGES.filter((s) => s.tier === tier && s.id !== previous)
  const choices = pool.length > 0 ? pool : STAGES.filter((s) => s.tier === tier)
  return choices[Math.floor(Math.random() * choices.length)].id
}
