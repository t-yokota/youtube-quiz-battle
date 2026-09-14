interface Motion {
  travel: number
  downMs: number
  holdMs: number
  upMs: number
}
export const defaultMotion: Readonly<Motion> = Object.freeze({
  travel: 0.15,
  downMs: 40,
  holdMs: 20,
  upMs: 80,
})
export function samplePress(elapsed: number, motion = defaultMotion, reduced = false) {
  const { downMs, holdMs, upMs } = motion
  if (reduced || elapsed < 0 || elapsed >= downMs + holdMs + upMs) return { depth: 0, done: true }
  if (downMs > 0 && elapsed < downMs) return { depth: elapsed / downMs, done: false }
  if (elapsed < downMs + holdMs) return { depth: 1, done: false }
  return { depth: upMs > 0 ? 1 - (elapsed - downMs - holdMs) / upMs : 0, done: false }
}
export function sampleGlow(elapsed: number, period = 500) {
  return (1 - Math.cos(((Math.max(0, elapsed) % period) / period) * Math.PI * 2)) / 2
}
