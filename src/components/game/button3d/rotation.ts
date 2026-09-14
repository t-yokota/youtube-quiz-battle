/** ネイティブbuttonの外側だけを回転操作に使う。途中でボタンを横切っても押下しない。 */
export function bindRotation(canvas: HTMLCanvasElement, rotate: (dx: number, dy: number) => void) {
  let drag: { id: number; x: number; y: number } | null = null
  const events = new AbortController()
  const clear = () => {
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
    drag = null
  }
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isPrimary || event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!drag || drag.id !== event.pointerId) return
      rotate(event.clientX - drag.x, event.clientY - drag.y)
      drag = { ...drag, x: event.clientX, y: event.clientY }
    },
    { signal: events.signal },
  )
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, clear, { signal: events.signal })
  }
  return {
    clear,
    dispose() {
      clear()
      events.abort()
    },
  }
}
