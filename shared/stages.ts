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

const ROYAL: Theme = {
  sky: ['#4a2a6b', '#221236', '#0b0612'],
  fog: '#160c24',
  pit: ['#ffe08a', '#c0841f'],
  torch: '#ffd27a',
  ambient: '#e6d2ff',
  block: '#4b3f5e',
  tint: '#fff4d6',
  props: ['chest_gold', 'candle_triple', 'chest'],
  wall: 'banner',
}

const SUNSET: Theme = {
  sky: ['#7a3b2e', '#3a1a22', '#120810'],
  fog: '#1f0f14',
  pit: ['#ffd0a0', '#ff6a4a'],
  torch: '#ffb48a',
  ambient: '#ffd6c2',
  block: '#4a3328',
  tint: '#fff0e0',
  props: ['barrel_large', 'trunk_large_A', 'column'],
  wall: 'bare',
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

// The same disc with the centre nine tiles left standing.
const DISC_WITH_CORE = DISC.map((row, r) => (r >= 3 && r <= 5 ? 'ooo###ooo' : row))

const SMALL_DISC = ['..ooo..', '.ooooo.', 'ooooooo', 'ooooooo', 'ooooooo', '.ooooo.', '..ooo..']

// How a tier paces its collapse. A stage can override any of these.
const PACE: Record<Tier, Pick<Stage, 'collapseDelay' | 'collapseTime' | 'warn' | 'chaos'>> = {
  normal: { collapseDelay: 8, collapseTime: 24, warn: 1, chaos: 0.15 },
  medium: { collapseDelay: 6, collapseTime: 20, warn: 0.9, chaos: 0.25 },
  hard: { collapseDelay: 5, collapseTime: 18, warn: 0.8, chaos: 0.3 },
  extreme: { collapseDelay: 3, collapseTime: 15, warn: 0.7, chaos: 0.5 },
}

type StageSpec = Pick<Stage, 'id' | 'name' | 'tier' | 'tiles' | 'theme' | 'map'> & Partial<Stage>

// Fills in what most stages share: players start two tiles either side of the centre, footing
// is normal, there are no hazards, and the collapse follows the tier's pace.
const stage = (spec: StageSpec): Stage => ({
  spawns: [
    [0, 2],
    [0, -2],
  ],
  grip: 1,
  hazards: [],
  ...PACE[spec.tier],
  ...spec,
})

// In order of difficulty: this order is also the solo campaign.
export const STAGES: Stage[] = [
  // ---------- Normal: open floors, a gentle collapse, almost no hazards ----------
  stage({ id: 'hall', name: 'The Great Hall', tier: 'normal', tiles: 'stone', theme: CRYPT, map: DISC_WITH_CORE, collapseTime: 25 }),
  stage({
    id: 'courtyard',
    name: 'Overgrown Courtyard',
    tier: 'normal',
    tiles: 'dirt',
    theme: GARDEN,
    map: ['ooooooo', 'ooooooo', 'oo###oo', 'oo###oo', 'oo###oo', 'ooooooo', 'ooooooo'],
  }),
  stage({
    id: 'longhall',
    name: 'The Long Table',
    tier: 'normal',
    tiles: 'wood',
    theme: TAVERN,
    map: ['..ooooo..', '.ooooooo.', 'ooo###ooo', 'ooo###ooo', 'ooo###ooo', '.ooooooo.', '..ooooo..'],
  }),
  stage({
    id: 'garden',
    name: 'Sunken Garden',
    tier: 'normal',
    tiles: 'dirt',
    theme: SUNSET,
    map: ['....o....', '...ooo...', '..ooooo..', '.ooo#ooo.', 'ooo###ooo', '.ooo#ooo.', '..ooooo..', '...ooo...', '....o....'],
  }),
  stage({
    id: 'anvil',
    name: 'The Anvil',
    tier: 'normal',
    tiles: 'stone',
    theme: ROYAL,
    map: ['.ooooo.', 'ooooooo', 'oo###oo', 'oo###oo', 'oo###oo', 'ooooooo', '.ooooo.'],
    hazards: [{ type: 'bumper', at: [0, 0] }],
  }),

  // ---------- Medium: awkward shapes and the first real hazards ----------
  stage({
    id: 'horseshoe',
    name: 'The Horseshoe',
    tier: 'medium',
    tiles: 'dirt',
    theme: GARDEN,
    map: ['ooo...ooo', 'ooo...ooo', 'ooo...ooo', 'ooo...ooo', 'ooo###ooo', 'ooo###ooo', '.ooooooo.'],
    spawns: [
      [-3, -2],
      [3, -2],
    ],
  }),
  stage({
    id: 'ring',
    name: 'The Ring',
    tier: 'medium',
    tiles: 'stone',
    theme: CRYPT,
    map: DISC.map((row, r) => (r === 4 ? 'ooo#.#ooo' : r === 3 || r === 5 ? 'ooo###ooo' : row)),
    spawns: [
      [0, 3],
      [0, -3],
    ],
    hazards: [{ type: 'sweeper', length: 3.5, period: 7 }],
  }),
  stage({
    id: 'crossing',
    name: 'The Crossing',
    tier: 'medium',
    tiles: 'wood',
    theme: TAVERN,
    map: ['...ooo...', '...ooo...', '...ooo...', 'ooo###ooo', 'ooo###ooo', 'ooo###ooo', '...ooo...', '...ooo...', '...ooo...'],
    spawns: [
      [0, 3],
      [0, -3],
    ],
    hazards: [
      { type: 'bumper', at: [2, 0] },
      { type: 'bumper', at: [-2, 0] },
    ],
  }),
  stage({
    id: 'mill',
    name: 'The Mill',
    tier: 'medium',
    tiles: 'wood',
    theme: SUNSET,
    map: ['..ooo..', '.ooooo.', 'oo###oo', 'oo###oo', 'oo###oo', '.ooooo.', '..ooo..'],
    hazards: [{ type: 'sweeper', length: 3, period: -6.5 }],
  }),
  stage({
    id: 'hourglass',
    name: 'The Hourglass',
    tier: 'medium',
    tiles: 'stone',
    theme: ROYAL,
    map: ['ooooooo', 'ooooooo', '.oo#oo.', '..###..', '.oo#oo.', 'ooooooo', 'ooooooo'],
    hazards: [{ type: 'spikes', tiles: [[0, 0]], period: 4.5 }],
  }),

  // ---------- Hard: gaps, narrow bridges, ice ----------
  stage({
    id: 'sieve',
    name: 'The Sieve',
    tier: 'hard',
    tiles: 'stone',
    theme: SEWER,
    map: ['...ooo...', '..ooooo..', '.oo.o.oo.', 'ooooooooo', 'ooo###ooo', 'ooooooooo', '.oo.o.oo.', '..ooooo..', '...ooo...'],
    hazards: [
      {
        type: 'spikes',
        tiles: [
          [-3, 0],
          [3, 0],
        ],
        period: 4,
      },
    ],
  }),
  stage({
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
    hazards: [{ type: 'spikes', tiles: [[0, 0]], period: 3.5 }],
  }),
  stage({
    id: 'frost',
    name: 'Frostbite',
    tier: 'hard',
    tiles: 'stone',
    theme: FROST,
    map: ['..ooo..', '.ooooo.', 'ooo#ooo', 'oo###oo', 'ooo#ooo', '.ooooo.', '..ooo..'],
    grip: 0.3,
    hazards: [
      { type: 'bumper', at: [2, 0] },
      { type: 'bumper', at: [-2, 0] },
    ],
  }),
  stage({
    id: 'bridges',
    name: 'Twin Bridges',
    tier: 'hard',
    tiles: 'wood',
    theme: ROYAL,
    // Only the left bridge survives, so the last ground is never split in two.
    map: ['.ooooo.', '.ooooo.', '.ooooo.', '.#...o.', '.#...o.', '.#...o.', '.ooooo.', '.ooooo.', '.ooooo.'],
    spawns: [
      [0, 3],
      [0, -3],
    ],
  }),
  stage({
    id: 'blackice',
    name: 'Black Ice',
    tier: 'hard',
    tiles: 'stone',
    theme: FROST,
    map: DISC_WITH_CORE,
    grip: 0.25,
    hazards: [{ type: 'sweeper', length: 4, period: 8 }],
  }),

  // ---------- Extreme: fast, chaotic, and nothing is left standing ----------
  stage({
    id: 'collapse',
    name: 'The Collapse',
    tier: 'extreme',
    tiles: 'stone',
    theme: INFERNO,
    map: DISC,
    collapseTime: 17,
    chaos: 1,
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
  }),
  stage({
    id: 'gauntlet',
    name: 'The Gauntlet',
    tier: 'extreme',
    tiles: 'wood',
    theme: SUNSET,
    map: ['ooo', 'ooo', 'ooo', 'ooo', 'ooo', 'ooo', 'ooo', 'ooo', 'ooo'],
    spawns: [
      [0, 3],
      [0, -3],
    ],
    collapseTime: 14,
    chaos: 0.2,
    hazards: [
      { type: 'bumper', at: [0, 0] },
      {
        type: 'spikes',
        tiles: [
          [0, 2],
          [0, -2],
        ],
        period: 3.2,
      },
    ],
  }),
  stage({
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
    collapseTime: 13,
    chaos: 0.2,
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
  }),
  stage({
    id: 'avalanche',
    name: 'Avalanche',
    tier: 'extreme',
    tiles: 'stone',
    theme: FROST,
    map: SMALL_DISC,
    grip: 0.3,
    collapseTime: 14,
    chaos: 1,
    hazards: [{ type: 'sweeper', length: 3, period: -4 }],
  }),
  stage({
    id: 'lastfloor',
    name: 'The Last Floor',
    tier: 'extreme',
    tiles: 'stone',
    theme: INFERNO,
    map: ['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo'],
    collapseDelay: 4,
    chaos: 0.6,
    hazards: [
      { type: 'sweeper', length: 2.5, period: 3.6 },
      {
        type: 'spikes',
        tiles: [
          [2, 2],
          [-2, 2],
          [2, -2],
          [-2, -2],
        ],
        period: 3.5,
      },
    ],
  }),
]

export const DEFAULT_STAGE = 'hall'

// The solo campaign: every stage, in the order above. Each level is a short match on one
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
