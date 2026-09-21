import { createApp, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import DesktopResizeHandles from '../DesktopResizeHandles.vue'
let cleanup = () => {}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('左右の境界は中心を基準に2倍の幅変更を通知し、幅の上限を守る', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const parent = document.createElement('div')
  document.body.append(parent)
  Object.defineProperty(parent, 'clientWidth', { value: 1440 })
  const change = vi.fn()
  const app = createApp(DesktopResizeHandles, { onResize: change })
  const host = document.createElement('div')
  Object.defineProperty(host, 'clientWidth', { value: 1440, configurable: true })
  parent.append(host)
  app.mount(host)
  cleanup = () => {
    app.unmount()
    parent.remove()
  }
  const area = host.querySelector('.desktop-resize-handles')!
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({ width: 840 } as DOMRect)
  const handles = host.querySelectorAll<HTMLElement>('[role="separator"]')
  for (const handle of handles) handle.setPointerCapture = vi.fn()
  const pointer = (type: string, clientX: number) =>
    new MouseEvent(type, { clientX, button: 0, bubbles: true })
  handles[1]!.dispatchEvent(pointer('pointerdown', 100))
  handles[1]!.dispatchEvent(pointer('pointermove', 120))
  expect(change).toHaveBeenLastCalledWith(880)
  handles[1]!.dispatchEvent(pointer('pointerup', 120))
  handles[0]!.dispatchEvent(pointer('pointerdown', 100))
  handles[0]!.dispatchEvent(pointer('pointermove', 120))
  expect(change).toHaveBeenLastCalledWith(800)
  handles[0]!.dispatchEvent(pointer('pointermove', -1000))
  expect(change).toHaveBeenLastCalledWith(960)
  handles[0]!.dispatchEvent(pointer('pointercancel', -1000))
  handles[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
  await nextTick()
  expect(change).toHaveBeenLastCalledWith(640)
  Object.defineProperty(host, 'clientWidth', { value: 1100 })
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({ width: 720 } as DOMRect)
  handles[1]!.dispatchEvent(pointer('pointerdown', 100))
  handles[1]!.dispatchEvent(pointer('pointermove', 120))
  expect(change).toHaveBeenLastCalledWith(740)
  handles[1]!.dispatchEvent(pointer('pointerup', 120))
  handles[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  expect(change).toHaveBeenLastCalledWith(860)
})
