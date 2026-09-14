import type { BuzzerModelId } from '@/constants/buzzer'
import { appearance } from './appearance'
import { createSimpleRound } from './models/simple-round'
import { createWasedaStyle } from './models/waseda-style'
const factories = { 'simple-round-v1': createSimpleRound, 'waseda-style-v1': createWasedaStyle }
export function createModel(id: BuzzerModelId) {
  return factories[id](appearance)
}
