import { advance } from '@react-three/fiber'

// Browsers pause animation frames and slow timers to once a second in a tab that is hidden or
// covered by another window. A paused player would freeze on everyone's screen and could not be
// knocked back, so timing here runs off a worker, which browsers leave alone.

type Job = { fn: () => void; dueAt: number; every: number | null }
const jobs = new Set<Job>()

// Hidden, the game is stepped at half rate. The physics uses a fixed timestep, so it simulates the same.
const HIDDEN_STEP_MS = 32
let lastTick = 0
let lastStep = 0

// The page's own animation frames, watched so that a stall is noticed however it comes about.
// Not every browser reports a covered window as hidden, but all of them stop its frames.
const STALLED_MS = 200
let lastFrame = performance.now()
const watchFrames = () => {
  lastFrame = performance.now()
  requestAnimationFrame(watchFrames)
}
requestAnimationFrame(watchFrames)

// True while the browser is not drawing this page: a background tab, a minimised or covered window.
export const inBackground = () => document.hidden || performance.now() - lastFrame > STALLED_MS

const worker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })))
worker.onmessage = () => {
  const now = performance.now()
  // If a tick ran long, the ones that queued up behind it arrive at once; drop them.
  if (now - lastTick < 8) return
  lastTick = now
  for (const job of jobs) {
    if (now < job.dueAt) continue
    if (job.every === null) jobs.delete(job)
    else job.dueAt = now + job.every
    job.fn()
  }
  // In the background nothing draws frames, so the game is stepped from here instead.
  if (inBackground() && now - lastStep >= HIDDEN_STEP_MS) {
    lastStep = now
    advance(now)
    lastTick = performance.now()
  }
}

// Like setInterval and setTimeout, but they keep their timing in a background tab.
export function every(ms: number, fn: () => void) {
  jobs.add({ fn, dueAt: performance.now() + ms, every: ms })
}

export function after(ms: number, fn: () => void) {
  jobs.add({ fn, dueAt: performance.now() + ms, every: null })
}
