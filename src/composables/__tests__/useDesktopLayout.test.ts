import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useDesktopLayout } from '../useDesktopLayout'
afterEach(() => vi.unstubAllGlobals())
it('フレーム幅とポインター条件の変更に追従し、破棄時に購読を解除する', () => {
  const listeners = new Set<() => void>()
  const query = {
    matches: false,
    addEventListener: vi.fn((name, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((name, listener) => listeners.delete(listener)),
  }
  const matchMedia = vi.fn(() => query)
  vi.stubGlobal('matchMedia', matchMedia)
  const scope = effectScope()
  const desktop = scope.run(useDesktopLayout)!
  expect(matchMedia).toHaveBeenCalledWith('(min-width: 1200px) and (pointer: fine)')
  expect(desktop.value).toBe(false)
  query.matches = true
  listeners.forEach((listener) => listener())
  expect(desktop.value).toBe(true)
  query.matches = false
  listeners.forEach((listener) => listener())
  expect(desktop.value).toBe(false)
  scope.stop()
  expect(listeners.size).toBe(0)
})
