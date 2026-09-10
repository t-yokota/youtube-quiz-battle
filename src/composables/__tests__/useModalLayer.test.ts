import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useModalLayer } from '../useModalLayer'
let app: ReturnType<typeof createApp>
let host: HTMLElement
let opener: HTMLButtonElement
const open = ref(false)
const warning = ref(false)
const close = vi.fn()
async function flush() {
  for (let i = 0; i < 5; i++) await nextTick()
}
function mount() {
  open.value = false
  warning.value = false
  close.mockClear()
  host = document.createElement('div')
  opener = document.createElement('button')
  opener.textContent = 'open'
  document.body.append(opener, host)
  opener.focus()
  const Layer = {
    props: ['visible', 'priority'],
    setup(props: { visible: boolean; priority: number }) {
      const root = ref<HTMLElement | null>(null)
      useModalLayer(root, () => props.visible, {
        label: 'テスト',
        priority: props.priority,
        close:
          props.priority === 1
            ? () => {
                close()
                open.value = false
              }
            : undefined,
      })
      return () =>
        props.visible
          ? h(
              'div',
              { ref: root },
              props.priority === 1
                ? [
                    h('button', { id: 'first' }, 'first'),
                    h('button', { disabled: true }, 'disabled'),
                    h('button', { id: 'last' }, 'last'),
                  ]
                : [],
            )
          : null
    },
  }
  app = createApp({
    render: () => [
      h(Layer, { visible: open.value, priority: 1 }),
      h(Layer, { visible: warning.value, priority: 2 }),
    ],
  })
  app.mount(host)
}
function key(key: string, shiftKey = false) {
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  )
}
afterEach(() => {
  app.unmount()
  host.remove()
  opener.remove()
})
it('開いたら内部へ移動しTabを循環させ、背景操作を遮断して閉じたら復元する', async () => {
  mount()
  const click = vi.fn()
  opener.addEventListener('click', click)
  open.value = true
  await flush()
  expect(document.activeElement?.id).toBe('first')
  expect(opener.hasAttribute('inert')).toBe(true)
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('テスト')
  key('Tab', true)
  expect(document.activeElement?.id).toBe('last')
  key('Tab')
  expect(document.activeElement?.id).toBe('first')
  opener.focus()
  expect(document.activeElement?.id).toBe('first')
  opener.click()
  expect(click).not.toHaveBeenCalled()
  key('Escape')
  await flush()
  expect(close).toHaveBeenCalledTimes(1)
  expect(document.activeElement).toBe(opener)
  expect(opener.hasAttribute('inert')).toBe(false)
})
it('操作要素のない上位警告が下位を遮断し、Escapeで閉じない', async () => {
  mount()
  open.value = true
  await flush()
  document.getElementById('last')!.focus()
  warning.value = true
  await flush()
  const top = host.querySelectorAll('[role="dialog"]')[1]
  expect(document.activeElement).toBe(top)
  key('Tab')
  expect(document.activeElement).toBe(top)
  key('Escape')
  expect(close).not.toHaveBeenCalled()
  warning.value = false
  await flush()
  expect(document.activeElement?.id).toBe('last')
  open.value = false
  await flush()
  expect(document.activeElement).toBe(opener)
})
it('unmountで背景の既存属性を復元する', async () => {
  mount()
  opener.setAttribute('aria-hidden', 'false')
  open.value = true
  await flush()
  app.unmount()
  expect(opener.hasAttribute('inert')).toBe(false)
  expect(opener.getAttribute('aria-hidden')).toBe('false')
})

it('フォーカス中の要素が取り除かれたらダイアログ内へ移し直す', async () => {
  mount()
  open.value = true
  await flush()
  document.getElementById('first')!.remove()
  await flush()
  expect(document.activeElement?.id).toBe('last')
})
it('上位警告の表示中に下位を閉じてもフォーカスを背面へ戻さない', async () => {
  mount()
  open.value = true
  await flush()
  warning.value = true
  await flush()
  const top = document.activeElement
  open.value = false
  await flush()
  expect(document.activeElement).toBe(top)
  warning.value = false
  await flush()
  expect(document.activeElement).toBe(opener)
})
