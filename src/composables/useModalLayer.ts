import { onBeforeUnmount, watch, type Ref } from 'vue'

interface ModalOptions {
  label: string | (() => string)
  priority: number
  close?: () => void
}
interface Layer extends ModalOptions {
  element: HTMLElement
  lastFocus: HTMLElement | null
}
const layers: Layer[] = []
const background = new Map<HTMLElement, { inert: string | null; hidden: string | null }>()
let originalFocus: HTMLElement | null = null
let observer: MutationObserver | null = null
const focusSelector =
  'button,input,select,textarea,a[href],[tabindex],summary,[contenteditable="true"]'
function topLayer() {
  return layers.reduce<Layer | undefined>(
    (top, layer) => (!top || layer.priority >= top.priority ? layer : top),
    undefined,
  )
}
function available(element: HTMLElement): boolean {
  if (
    !element.isConnected ||
    element.matches(':disabled') ||
    element.closest('[inert],[hidden],[aria-hidden="true"]')
  )
    return false
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}
function controls(layer: Layer) {
  return [...layer.element.querySelectorAll<HTMLElement>(focusSelector)].filter(
    (el) => el.tabIndex >= 0 && available(el),
  )
}
function focusLayer(layer: Layer) {
  const preferred = layer.lastFocus
  const target =
    preferred && layer.element.contains(preferred) && available(preferred)
      ? preferred
      : (controls(layer).find((el) => el.hasAttribute('data-dialog-autofocus')) ??
        controls(layer)[0] ??
        layer.element)
  target.focus({ preventScroll: true })
}
function restoreBackground() {
  for (const [element, attrs] of background) {
    for (const [key, value] of [
      ['inert', attrs.inert],
      ['aria-hidden', attrs.hidden],
    ] as const) {
      if (value === null) element.removeAttribute(key)
      else element.setAttribute(key, value)
    }
  }
  background.clear()
}
function updateBackground() {
  restoreBackground()
  const top = topLayer()
  if (!top) return
  // 背景をaria-hiddenにする前にフォーカスを移し、動的な要素削除にも追従する。
  if (!top.element.contains(document.activeElement)) focusLayer(top)
  function visit(parent: HTMLElement) {
    for (const element of [...parent.children]) {
      if (!(element instanceof HTMLElement) || element === top!.element) continue
      if (element.contains(top!.element)) {
        visit(element)
        continue
      }
      background.set(element, {
        inert: element.getAttribute('inert'),
        hidden: element.getAttribute('aria-hidden'),
      })
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    }
  }
  visit(document.body)
}
function onKey(event: KeyboardEvent) {
  const top = topLayer()
  if (!top) return
  if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    event.stopImmediatePropagation()
    top.close?.()
  } else if (event.key === 'Tab') {
    const items = controls(top)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (
      !items.length ||
      index === -1 ||
      (event.shiftKey ? index === 0 : index === items.length - 1)
    ) {
      event.preventDefault()
      const target = event.shiftKey ? items.at(-1) : items[0]
      ;(target ?? top.element).focus({ preventScroll: true })
    }
  }
}
function onFocus(event: FocusEvent) {
  const top = topLayer()
  if (!top) return
  if (event.target instanceof HTMLElement && top.element.contains(event.target))
    top.lastFocus = event.target
  else focusLayer(top)
}
function onPointer(event: Event) {
  const top = topLayer()
  if (top && event.target instanceof Node && !top.element.contains(event.target)) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
function register(layer: Layer) {
  if (!layers.length) {
    originalFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('click', onPointer, true)
    document.addEventListener('pointerdown', onPointer, true)
    observer = new MutationObserver(updateBackground)
    observer.observe(document.body, { childList: true, subtree: true })
  }
  const previous = topLayer()
  layers.push(layer)
  updateBackground()
  if (topLayer() !== previous) focusLayer(topLayer()!)
}
function unregister(layer: Layer) {
  const wasTop = topLayer() === layer
  const index = layers.indexOf(layer)
  if (index < 0) return
  layers.splice(index, 1)
  updateBackground()
  const top = topLayer()
  if (top) {
    if (wasTop) focusLayer(top)
    return
  }
  observer?.disconnect()
  observer = null
  document.removeEventListener('keydown', onKey, true)
  document.removeEventListener('focusin', onFocus, true)
  document.removeEventListener('click', onPointer, true)
  document.removeEventListener('pointerdown', onPointer, true)
  const gate = document.querySelector<HTMLElement>('[data-dialog-return-focus="gate"]')
  const fallback =
    gate && available(gate)
      ? gate
      : [...document.querySelectorAll<HTMLElement>('[data-dialog-return-focus]')].find(available)
  const target =
    originalFocus && originalFocus !== document.body && available(originalFocus)
      ? originalFocus
      : fallback
  target?.focus({ preventScroll: true })
  originalFocus = null
}

/** 既存のDOMとCSSを保ち、ダイアログ間の優先順位・フォーカス・背景遮断を共有する。 */
export function useModalLayer(
  element: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  options: ModalOptions,
) {
  let layer: Layer | null = null
  function stop() {
    if (layer) {
      const node = layer.element
      unregister(layer)
      node.setAttribute('inert', '')
      node.setAttribute('aria-hidden', 'true')
      node.removeAttribute('aria-modal')
    }
    layer = null
  }
  watch(
    [isOpen, element],
    ([open, node]) => {
      stop()
      if (!open || !node) return
      node.setAttribute('role', 'dialog')
      node.setAttribute('aria-modal', 'true')
      node.removeAttribute('inert')
      node.removeAttribute('aria-hidden')
      node.setAttribute(
        'aria-label',
        typeof options.label === 'function' ? options.label() : options.label,
      )
      node.setAttribute('tabindex', '-1')
      layer = { ...options, element: node, lastFocus: null }
      register(layer)
    },
    { flush: 'post', immediate: true },
  )
  onBeforeUnmount(stop)
}
