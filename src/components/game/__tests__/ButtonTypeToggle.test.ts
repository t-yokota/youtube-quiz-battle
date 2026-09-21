import { createApp, h, nextTick, reactive } from 'vue'
import { expect, it, vi } from 'vitest'
import ButtonTypeToggle from '../ButtonTypeToggle.vue'
import type { ButtonModelId } from '@/constants/button'

it('現在のモデルを示し、切替先を通知する。外部変更と操作禁止にも追従する', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
  let pendingFrame: FrameRequestCallback | undefined
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      pendingFrame = callback
      return 1
    }),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  async function beginRotation() {
    await nextTick()
    await nextTick()
    expect(host.querySelector('.type-rotor.preparing')).not.toBeNull()
    pendingFrame?.(0)
    pendingFrame?.(16)
    await nextTick()
  }
  const props = reactive({ modelId: 'simple-round-v1' as ButtonModelId, disabled: false })
  const toggle = vi.fn(() => {
    props.modelId = 'waseda-style-v1'
  })
  const host = document.createElement('div')
  const app = createApp(() => h(ButtonTypeToggle, { ...props, onToggle: toggle }))
  app.mount(host)
  try {
    const button = host.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('箱型（大ランプ）に切り替え')
    button.click()
    await beginRotation()
    expect(toggle).toHaveBeenCalledOnce()
    expect(host.querySelector('.type-rotor.box')).not.toBeNull()
    expect(button.getAttribute('aria-label')).toBe('丸型に切り替え')
    expect(host.querySelector('.is-static')).toBeNull()
    host.querySelector('.type-rotor')!.dispatchEvent(new Event('transitionend'))
    await nextTick()
    expect(host.querySelector('.is-static')).not.toBeNull()
    props.modelId = 'simple-round-v1'
    props.disabled = true
    await beginRotation()
    expect(host.querySelector('.type-rotor.box')).toBeNull()
    button.click()
    expect(toggle).toHaveBeenCalledOnce()
  } finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
