import { createApp, nextTick, ref, type Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PwaUpdatePrompt from '@/components/common/PwaUpdatePrompt.vue'

const swMock = vi.hoisted(() => ({
  needRefresh: undefined as unknown as Ref<boolean>,
  updateServiceWorker: vi.fn(),
}))

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({
    needRefresh: swMock.needRefresh,
    offlineReady: ref(false),
    updateServiceWorker: swMock.updateServiceWorker,
  }),
}))

describe('PwaUpdatePrompt', () => {
  let host: HTMLDivElement
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    swMock.needRefresh = ref(false)
    swMock.updateServiceWorker.mockResolvedValue(undefined)
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(PwaUpdatePrompt)
    app.mount(host)
  })

  afterEach(() => {
    app.unmount()
    host.remove()
    document.body.replaceChildren()
    vi.clearAllMocks()
  })

  it('更新がない間は通知を表示しない', () => {
    expect(document.querySelector('.pwa-update-prompt')).toBeNull()
  })

  it('新しいバージョンを検出すると更新通知を表示する', async () => {
    swMock.needRefresh.value = true
    await nextTick()

    const prompt = document.querySelector<HTMLElement>('.pwa-update-prompt')
    expect(prompt?.getAttribute('role')).toBe('status')
    expect(prompt?.getAttribute('aria-live')).toBe('polite')
    expect(prompt?.textContent).toContain('新しいバージョンがあります')
  })

  it('更新ボタンで新しいService Workerを適用して再読み込みする', async () => {
    swMock.needRefresh.value = true
    await nextTick()

    document.querySelector<HTMLButtonElement>('.pwa-update-action')?.click()
    await nextTick()

    expect(swMock.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('あとでを選ぶと現在のバージョンのまま通知を閉じる', async () => {
    swMock.needRefresh.value = true
    await nextTick()

    document.querySelector<HTMLButtonElement>('.pwa-update-dismiss')?.click()
    await nextTick()

    expect(swMock.needRefresh.value).toBe(false)
    expect(swMock.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('更新に失敗した場合は再試行できるメッセージを表示する', async () => {
    swMock.updateServiceWorker.mockRejectedValueOnce(new Error('update failed'))
    swMock.needRefresh.value = true
    await nextTick()

    document.querySelector<HTMLButtonElement>('.pwa-update-action')?.click()

    await vi.waitFor(() => {
      expect(document.querySelector('.pwa-update-message')?.textContent).toContain(
        '更新できませんでした',
      )
    })
    expect(document.querySelector<HTMLButtonElement>('.pwa-update-action')?.disabled).toBe(false)
  })
})
