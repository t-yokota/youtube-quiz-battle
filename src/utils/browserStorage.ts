import { logger } from './logger'

/** Persistence is optional: blocked storage must not interrupt the active session. */
export function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    logger.warn('[Storage] Read unavailable:', key)
    return null
  }
}

export function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    logger.warn('[Storage] Write unavailable:', key)
  }
}
