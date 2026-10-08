// What each side did over the current match, for the summary on the end screen.
// "them" is the bot or the other player. Kept outside React; the end screen reads it once.

export type Tally = { hits: number; blocks: number; items: number }

const empty = (): Tally => ({ hits: 0, blocks: 0, items: 0 })

export const stats = { me: empty(), them: empty(), startedAt: performance.now() }

export function resetStats() {
  stats.me = empty()
  stats.them = empty()
  stats.startedAt = performance.now()
}

const side = (id: string) => (id === 'me' ? stats.me : stats.them)

// A dash from `attacker` reached someone. Counted as landed, or as a block for `victim`.
export function recordHit(attacker: string, victim: string, blocked: boolean) {
  if (blocked) side(victim).blocks++
  else side(attacker).hits++
}

// Online, a hit we counted as landed turned out to have been blocked.
export function recordBlockedAfterAll() {
  stats.me.hits = Math.max(0, stats.me.hits - 1)
  stats.them.blocks++
}

export const recordItem = (id: string) => void side(id).items++
