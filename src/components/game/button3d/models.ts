import type { ButtonModelId } from '@/constants/button'
import { appearance } from './appearance'
import { createSimpleRound } from './models/simple-round'
import { createWasedaStyle } from './models/waseda-style'
const factories = { 'simple-round-v1': createSimpleRound, 'waseda-style-v1': createWasedaStyle }
export function createModel(id: ButtonModelId) {
  return factories[id](appearance)
}
