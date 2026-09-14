import { getButtonPreviewImage } from '../buttonPreviewImage'

const fake = vi.hoisted(() => ({
  create: vi.fn(),
  capture: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('@/components/game/button3d/view', () => ({ createButtonView: fake.create }))
beforeEach(() => {
  vi.resetAllMocks()
  fake.capture.mockReturnValue('data:image/png;base64,preview')
  fake.create.mockReturnValue({ captureSnapshot: fake.capture, dispose: fake.dispose })
})
it('同じモデルと寸法の画像を共有し、描画後にビューと一時DOMを解放する', () => {
  const count = document.body.children.length
  const first = getButtonPreviewImage('simple-round-v1', 200, 250)
  expect(getButtonPreviewImage('simple-round-v1', 200, 250)).toBe(first)
  expect(fake.create).toHaveBeenCalledTimes(1)
  expect(fake.dispose).toHaveBeenCalledWith(true)
  expect(document.body.children.length).toBe(count)
  getButtonPreviewImage('waseda-style-v1', 200, 250)
  getButtonPreviewImage('simple-round-v1', 200, 300)
  expect(fake.create).toHaveBeenCalledTimes(3)
})
it('生成失敗時も解放し、失敗をキャッシュしない', () => {
  const count = document.body.children.length
  fake.capture.mockImplementationOnce(() => {
    throw new Error('capture failed')
  })
  expect(() => getButtonPreviewImage('waseda-style-v1', 210, 250)).toThrow('capture failed')
  expect(fake.dispose).toHaveBeenCalledWith(true)
  expect(document.body.children.length).toBe(count)
  expect(getButtonPreviewImage('waseda-style-v1', 210, 250)).toContain('data:image/png')
})
