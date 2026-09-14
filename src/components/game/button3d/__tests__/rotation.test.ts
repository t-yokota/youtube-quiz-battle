import { bindRotation } from '../rotation'
function pointer(type: string, values = {}) {
  const event = new Event(type)
  Object.assign(event, { isPrimary: true, button: 0, pointerId: 1, clientX: 0, clientY: 0 }, values)
  return event
}
it('台座からの回転は捕捉したポインターだけを追い、cancelと破棄で停止する', () => {
  const canvas = document.createElement('canvas')
  let captured = false
  canvas.setPointerCapture = vi.fn(() => {
    captured = true
  })
  canvas.hasPointerCapture = vi.fn(() => captured)
  canvas.releasePointerCapture = vi.fn(() => {
    captured = false
  })
  const rotate = vi.fn()
  const binding = bindRotation(canvas, rotate)
  canvas.dispatchEvent(pointer('pointerdown', { isPrimary: false }))
  canvas.dispatchEvent(pointer('pointermove', { clientX: 10 }))
  expect(rotate).not.toHaveBeenCalled()
  canvas.dispatchEvent(pointer('pointerdown'))
  canvas.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 20 }))
  canvas.dispatchEvent(pointer('pointermove', { clientX: 10, clientY: 5 }))
  expect(rotate).toHaveBeenCalledExactlyOnceWith(10, 5)
  canvas.dispatchEvent(pointer('pointercancel'))
  canvas.dispatchEvent(pointer('pointermove', { clientX: 20 }))
  expect(rotate).toHaveBeenCalledOnce()
  canvas.dispatchEvent(pointer('pointerdown'))
  binding.dispose()
  expect(captured).toBe(false)
  canvas.dispatchEvent(pointer('pointerdown'))
  canvas.dispatchEvent(pointer('pointermove'))
  expect(rotate).toHaveBeenCalledOnce()
})
